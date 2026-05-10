"""APScheduler-based scheduled search execution service."""

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

import schedules
import search_service
from api.schemas import Schedule, ScheduleRun
from config import load_config
import emailer

log = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def start() -> None:
    """Start the scheduler and register all enabled schedules."""
    global _scheduler
    if _scheduler is not None:
        log.warning("Scheduler already started")
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    register_all_schedules()
    _scheduler.start()
    log.info("Scheduler started")


def shutdown() -> None:
    """Shutdown the scheduler."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("Scheduler shut down")


def register_all_schedules() -> None:
    """Register all enabled schedules as jobs."""
    if _scheduler is None:
        raise RuntimeError("Scheduler not started")
    for sched in schedules.list_schedules():
        if sched.enabled:
            schedule_job(sched)


def schedule_job(sched: Schedule) -> None:
    """Schedule a job for the given schedule."""
    if _scheduler is None:
        raise RuntimeError("Scheduler not started")
    trigger = CronTrigger.from_crontab(sched.cron_expression, timezone="UTC")
    _scheduler.add_job(
        _run_schedule,
        trigger=trigger,
        args=[sched.name],
        id=sched.name,
        replace_existing=True,
    )
    log.info(f"Scheduled job '{sched.name}' with cron '{sched.cron_expression}'")


def unschedule_job(name: str) -> None:
    """Remove a job from the scheduler."""
    if _scheduler is None:
        return
    try:
        _scheduler.remove_job(name)
        log.info(f"Unscheduled job '{name}'")
    except Exception:
        # JobLookupError if not found
        pass


def refresh_job(sched: Schedule) -> None:
    """Refresh a job: schedule if enabled, unschedule otherwise."""
    if sched.enabled:
        schedule_job(sched)
    else:
        unschedule_job(sched.name)


def trigger_now(name: str) -> ScheduleRun:
    """Execute a schedule immediately in a thread with 90s timeout."""
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_run_schedule, name)
        try:
            future.result(timeout=90)
        except FutureTimeoutError:
            log.error(f"Schedule '{name}' timed out after 90s")

    # Reload the schedule to get the latest run
    sched = schedules.get_schedule(name)
    if sched is None or sched.last_run is None:
        # Fallback if something went wrong
        return ScheduleRun(
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            status="failed",
            error="Schedule not found or run not recorded",
        )
    return sched.last_run


def _run_schedule(name: str) -> None:
    """Execute a scheduled search. Called by APScheduler or trigger_now."""
    started_at = datetime.now(timezone.utc)

    try:
        # Load fresh schedule from disk
        sched = schedules.get_schedule(name)
        if sched is None:
            log.error(f"Schedule '{name}' not found")
            return

        # Load SMTP config
        cfg = load_config()

        # Determine recipients
        recipients = sched.recipients if sched.recipients else None

        # Run the search
        flights = search_service.run(sched.request, headless=cfg.headless)

        # Send email if flights found
        if flights:
            origin = sched.request.origins[0]
            roundtrip = sched.request.trip_type == "roundtrip"
            emailer.send_flight_alert(
                flights=flights,
                smtp_email=cfg.smtp_email,
                smtp_password=cfg.smtp_password,
                email_to=cfg.email_to,
                origin=origin,
                roundtrip=roundtrip,
                subject=sched.subject,
                recipients=recipients,
            )

        # Record success
        run = ScheduleRun(
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            status="success",
            flight_count=len(flights),
        )
        schedules.record_run(name, run)
        log.info(f"Schedule '{name}' completed: {len(flights)} flights")

    except Exception as e:
        log.exception(f"Schedule '{name}' failed")
        run = ScheduleRun(
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            status="failed",
            error=str(e)[:500],
        )
        schedules.record_run(name, run)
