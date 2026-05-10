"""Schedules CRUD — pure JSON file storage, no scheduler interaction."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from api.schemas import CreateScheduleRequest, Schedule, ScheduleRun, UpdateScheduleRequest


def _schedules_path() -> Path:
    """Return the path to schedules.json (configurable via env var for tests)."""
    path_str = os.getenv("LAZY_HOPPER_SCHEDULES_PATH")
    if path_str:
        return Path(path_str)
    return Path(__file__).parent / "schedules.json"


def _read() -> list[Schedule]:
    """Read all schedules from disk."""
    path = _schedules_path()
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    return [Schedule.model_validate(s) for s in data.get("schedules", [])]


def _write(schedules: list[Schedule]) -> None:
    """Atomically write all schedules to disk."""
    path = _schedules_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    envelope = {"schedules": [s.model_dump(by_alias=False) for s in schedules]}
    tmp.write_text(json.dumps(envelope, indent=2, default=str))
    os.replace(tmp, path)


def list_schedules() -> list[Schedule]:
    """List all schedules."""
    return _read()


def get_schedule(name: str) -> Schedule | None:
    """Get a schedule by name."""
    schedules = _read()
    for s in schedules:
        if s.name == name:
            return s
    return None


def create_schedule(req: CreateScheduleRequest) -> Schedule:
    """Create a new schedule. Raises ValueError if duplicate name."""
    schedules = _read()
    if any(s.name == req.name for s in schedules):
        raise ValueError(f"schedule '{req.name}' already exists")

    schedule = Schedule(
        name=req.name,
        cron_expression=req.cron_expression,
        request=req.request,
        recipients=req.recipients,
        subject=req.subject,
        enabled=req.enabled,
        created_at=datetime.now(timezone.utc),
    )
    schedules.append(schedule)
    _write(schedules)
    return schedule


def update_schedule(name: str, req: UpdateScheduleRequest) -> Schedule | None:
    """Update a schedule. Returns None if not found."""
    schedules = _read()
    for i, s in enumerate(schedules):
        if s.name == name:
            # Preserve created_at, last_run, runs
            updated_dict = s.model_dump()
            if req.name is not None:
                updated_dict["name"] = req.name
            if req.cron_expression is not None:
                updated_dict["cron_expression"] = req.cron_expression
            if req.request is not None:
                updated_dict["request"] = req.request
            if req.recipients is not None:
                updated_dict["recipients"] = req.recipients
            if req.subject is not None:
                updated_dict["subject"] = req.subject
            if req.enabled is not None:
                updated_dict["enabled"] = req.enabled
            schedules[i] = Schedule.model_validate(updated_dict)
            _write(schedules)
            return schedules[i]
    return None


def delete_schedule(name: str) -> bool:
    """Delete a schedule. Returns True if deleted, False if not found."""
    schedules = _read()
    filtered = [s for s in schedules if s.name != name]
    if len(filtered) == len(schedules):
        return False
    _write(filtered)
    return True


def record_run(name: str, run: ScheduleRun) -> None:
    """Record a run execution for a schedule. Keeps only last 10 runs."""
    schedules = _read()
    for i, s in enumerate(schedules):
        if s.name == name:
            s.last_run = run
            s.runs.append(run)
            s.runs = s.runs[-10:]  # Keep last 10
            schedules[i] = s
            _write(schedules)
            return
