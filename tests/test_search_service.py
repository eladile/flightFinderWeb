"""Tests for search orchestration."""

import logging
from datetime import date
from unittest.mock import patch

from api.schemas import SearchRequest
import search_service


def _roundtrip_request() -> SearchRequest:
    return SearchRequest(
        origins=["TLV"],
        destinations=["NRT"],
        trip_type="roundtrip",
        outbound_date_from=date(2026, 10, 15),
        outbound_date_to=date(2026, 10, 15),
        return_date_from=date(2026, 10, 22),
        return_date_to=date(2026, 10, 22),
        stops="nonstop",
        providers=["google"],
    )


def test_run_streaming_reports_failed_job(caplog):
    """A scraper exception becomes a job_failed event and is logged with job context."""
    boom = RuntimeError("BrowserType.launch: Executable doesn't exist")

    with caplog.at_level(logging.WARNING, logger="search_service"):
        with patch("scraper.search_flights_for_job", side_effect=boom):
            events = list(search_service.run_streaming(_roundtrip_request()))

    failed = [e for e in events if e.type == "job_failed"]
    assert len(failed) == 1
    assert "Executable doesn't exist" in failed[0].error

    done = [e for e in events if e.type == "done"]
    assert done[0].failed_jobs == 1
    assert done[0].total_flights == 0

    # The failure must reach the server log, not only the SSE stream.
    assert "TLV->NRT" in caplog.text
    assert "out=2026-10-15" in caplog.text
    assert "ret=2026-10-22" in caplog.text
    assert "Executable doesn't exist" in caplog.text
