"""Search orchestration — the single entry point for executing a SearchRequest.

Both the cron (main.py) and the UI (api/routes/search.py) call into this module.
The cron uses run(), which returns a flat list of Flight objects. The UI uses
run_streaming(), which yields SSE event models as jobs complete, so results
can stream to the browser.

Fan-out math: a SearchRequest expands to
    |origins| * |destinations| * |outbound_dates| * |return_dates or 1|
SearchJob objects. We cap expansion at MAX_JOBS (50) to prevent runaway scraper
activity that would take minutes and get us rate-limited.

Concurrency: run_streaming uses a small ThreadPoolExecutor (3 workers by
default) since the Playwright scraper is sync. 3 Chromium contexts is a
sweet spot — more tends to trigger Google Flights' anti-bot throttling.
"""

from __future__ import annotations

import logging
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import date, timedelta
from typing import Iterator

from api.schemas import (
    DoneEvent,
    Flight as FlightSchema,
    FlightEvent,
    JobCompletedEvent,
    JobFailedEvent,
    JobStartedEvent,
    PlanEvent,
    SSEEvent,
    SearchJob,
    SearchRequest,
)
from config import Flight as FlightDC

log = logging.getLogger(__name__)

MAX_JOBS = 50
DEFAULT_CONCURRENCY = 3


class TooManyJobsError(ValueError):
    """Raised when a SearchRequest would fan out to more than MAX_JOBS jobs."""


def expand(req: SearchRequest) -> list[SearchJob]:
    """Cartesian-expand a SearchRequest into a list of SearchJob objects.

    Date inclusive on both ends. For oneway trips, return_date is None.
    For roundtrip, every outbound × every return date is emitted.
    """
    outbound_dates = _date_range(req.outbound_date_from, req.outbound_date_to)
    if req.trip_type == "roundtrip":
        assert req.return_date_from is not None and req.return_date_to is not None
        return_dates: list[date | None] = list(
            _date_range(req.return_date_from, req.return_date_to)
        )
    else:
        return_dates = [None]

    jobs: list[SearchJob] = []
    counter = 0
    for origin in req.origins:
        for dest in req.destinations:
            for out in outbound_dates:
                for ret in return_dates:
                    counter += 1
                    jobs.append(
                        SearchJob(
                            id=f"j{counter}",
                            origin=origin,
                            destination=dest,
                            outbound_date=out,
                            return_date=ret,
                            stops=req.stops,
                            providers=req.providers,
                        )
                    )
                    if counter > MAX_JOBS:
                        raise TooManyJobsError(
                            f"Search would produce {counter} jobs (cap is {MAX_JOBS}); "
                            "narrow date range or reduce destinations."
                        )
    return jobs


def _date_range(start: date, end: date) -> list[date]:
    if end < start:
        raise ValueError(f"end date {end} precedes start date {start}")
    return [start + timedelta(days=n) for n in range((end - start).days + 1)]


def run(req: SearchRequest, headless: bool = True) -> list[FlightDC]:
    """Execute a SearchRequest as a batch and return all flights.

    Used by the cron path. Delegates to each provider's batch search_flights()
    so the cron keeps its "one browser, many searches" efficiency. The batch
    APIs accept a single origin (which matches today's cron); if a caller
    passes multiple origins, we loop over them.
    """
    import scraper
    import skyscanner

    stops_arg = str(req.stops) if isinstance(req.stops, int) else req.stops
    return_from = req.return_date_from.isoformat() if req.return_date_from else ""
    return_to = req.return_date_to.isoformat() if req.return_date_to else ""

    all_flights: list[FlightDC] = []
    for origin in req.origins:
        kwargs = dict(
            origin=origin,
            destinations=list(req.destinations),
            date_from=req.outbound_date_from.isoformat(),
            date_to=req.outbound_date_to.isoformat(),
            return_from=return_from,
            return_to=return_to,
            stops=stops_arg,
            headless=headless,
        )
        for provider in req.providers:
            if provider == "google":
                all_flights.extend(scraper.search_flights(**kwargs))
            elif provider == "skyscanner":
                all_flights.extend(skyscanner.search_flights(**kwargs))
    return all_flights


def run_streaming(
    req: SearchRequest,
    headless: bool = True,
    concurrency: int = DEFAULT_CONCURRENCY,
) -> Iterator[SSEEvent]:
    """Execute a SearchRequest concurrently, yielding SSE events as work progresses.

    Yields (in order):
      1. One PlanEvent announcing all jobs up front.
      2. JobStartedEvent / FlightEvent* / JobCompletedEvent|JobFailedEvent per job,
         interleaved across concurrent jobs.
      3. One DoneEvent with aggregate counts.
    """
    from scraper import search_flights_for_job

    jobs = expand(req)
    yield PlanEvent(total_jobs=len(jobs), jobs=jobs)

    total_flights = 0
    failed_jobs = 0

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures: dict[Future, SearchJob] = {}
        for job in jobs:
            fut = pool.submit(search_flights_for_job, job, headless)
            futures[fut] = job
            yield JobStartedEvent(job_id=job.id)

        for fut in _as_completed_ordered(futures):
            job = futures[fut]
            try:
                flights = fut.result()
                for dc_flight in flights:
                    total_flights += 1
                    yield FlightEvent(
                        job_id=job.id,
                        flight=FlightSchema.model_validate(dc_flight.__dict__),
                    )
                yield JobCompletedEvent(job_id=job.id, flight_count=len(flights))
            except Exception as e:
                failed_jobs += 1
                yield JobFailedEvent(job_id=job.id, error=str(e))

    yield DoneEvent(total_flights=total_flights, failed_jobs=failed_jobs)


def _as_completed_ordered(futures: dict[Future, SearchJob]) -> Iterator[Future]:
    """Yield futures in completion order. Thin wrapper for test seams."""
    from concurrent.futures import as_completed
    yield from as_completed(futures.keys())
