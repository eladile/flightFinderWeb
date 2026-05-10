"""Scheduled searches API routes."""

import logging

from fastapi import APIRouter, HTTPException

import schedules
import scheduler_service
from api.schemas import CreateScheduleRequest, Schedule, ScheduleRun, UpdateScheduleRequest

router = APIRouter(prefix="/api/schedules", tags=["schedules"])
log = logging.getLogger(__name__)


@router.get("")
def list_schedules_endpoint() -> list[Schedule]:
    """List all schedules."""
    return schedules.list_schedules()


@router.post("", status_code=201)
def create_schedule_endpoint(req: CreateScheduleRequest) -> Schedule:
    """Create a new schedule."""
    try:
        sched = schedules.create_schedule(req)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Register with scheduler
    scheduler_service.refresh_job(sched)
    return sched


@router.put("/{name}")
def update_schedule_endpoint(name: str, req: UpdateScheduleRequest) -> Schedule:
    """Update an existing schedule."""
    updated = schedules.update_schedule(name, req)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"schedule '{name}' not found")

    # Refresh scheduler job
    scheduler_service.refresh_job(updated)
    return updated


@router.delete("/{name}", status_code=204)
def delete_schedule_endpoint(name: str) -> None:
    """Delete a schedule."""
    # Unschedule first
    scheduler_service.unschedule_job(name)
    deleted = schedules.delete_schedule(name)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"schedule '{name}' not found")


@router.post("/{name}/trigger")
def trigger_schedule_endpoint(name: str) -> ScheduleRun:
    """Trigger a schedule immediately."""
    sched = schedules.get_schedule(name)
    if sched is None:
        raise HTTPException(status_code=404, detail=f"schedule '{name}' not found")

    return scheduler_service.trigger_now(name)


@router.get("/{name}/runs")
def get_schedule_runs_endpoint(name: str) -> dict:
    """Get run history for a schedule."""
    sched = schedules.get_schedule(name)
    if sched is None:
        raise HTTPException(status_code=404, detail=f"schedule '{name}' not found")

    return {"runs": sched.runs}
