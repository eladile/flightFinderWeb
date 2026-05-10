"""Tests for schedules CRUD module."""

from datetime import date, datetime, timezone

import pytest

import schedules
from api.schemas import CreateScheduleRequest, SearchRequest, ScheduleRun, UpdateScheduleRequest


def test_list_empty(tmp_schedules_path):
    """List schedules when file doesn't exist returns empty list."""
    result = schedules.list_schedules()
    assert result == []


def test_create_then_get(tmp_schedules_path):
    """Create and retrieve a schedule."""
    req = CreateScheduleRequest(
        name="test-schedule",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 7),
            stops="any",
        ),
    )
    created = schedules.create_schedule(req)
    assert created.name == "test-schedule"
    assert created.cron_expression == "0 9 * * 1"
    assert created.enabled is True

    retrieved = schedules.get_schedule("test-schedule")
    assert retrieved is not None
    assert retrieved.name == "test-schedule"


def test_create_duplicate_rejects(tmp_schedules_path):
    """Creating a duplicate schedule raises ValueError."""
    req = CreateScheduleRequest(
        name="dup",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 7),
            stops="any",
        ),
    )
    schedules.create_schedule(req)

    with pytest.raises(ValueError, match="already exists"):
        schedules.create_schedule(req)


def test_update_preserves_created_at(tmp_schedules_path):
    """Updating a schedule preserves created_at."""
    req = CreateScheduleRequest(
        name="update-test",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 7),
            stops="any",
        ),
    )
    created = schedules.create_schedule(req)
    original_created_at = created.created_at

    update_req = UpdateScheduleRequest(enabled=False)
    updated = schedules.update_schedule("update-test", update_req)
    assert updated is not None
    assert updated.created_at == original_created_at
    assert updated.enabled is False


def test_delete(tmp_schedules_path):
    """Delete removes a schedule."""
    req = CreateScheduleRequest(
        name="delete-me",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 7),
            stops="any",
        ),
    )
    schedules.create_schedule(req)
    deleted = schedules.delete_schedule("delete-me")
    assert deleted is True

    retrieved = schedules.get_schedule("delete-me")
    assert retrieved is None


def test_record_run_keeps_last_10(tmp_schedules_path):
    """Recording runs keeps only the last 10."""
    req = CreateScheduleRequest(
        name="run-test",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 7),
            stops="any",
        ),
    )
    schedules.create_schedule(req)

    # Record 12 runs
    for i in range(12):
        run = ScheduleRun(
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            status="success",
            flight_count=i,
        )
        schedules.record_run("run-test", run)

    sched = schedules.get_schedule("run-test")
    assert sched is not None
    assert len(sched.runs) == 10
    assert sched.last_run is not None
    assert sched.last_run.flight_count == 11  # Last recorded run


def test_schema_rejects_bad_name():
    """Schema rejects names with spaces or uppercase."""
    with pytest.raises(Exception):  # ValidationError
        CreateScheduleRequest(
            name="Bad Name",
            cron_expression="0 9 * * 1",
            request=SearchRequest(
                origins=["TLV"],
                destinations=["BER"],
                trip_type="oneway",
                outbound_date_from=date(2026, 6, 1),
                outbound_date_to=date(2026, 6, 7),
                stops="any",
            ),
        )


def test_schema_rejects_bad_cron():
    """Schema rejects invalid cron expressions."""
    with pytest.raises(Exception):  # ValidationError
        CreateScheduleRequest(
            name="test",
            cron_expression="foo bar",
            request=SearchRequest(
                origins=["TLV"],
                destinations=["BER"],
                trip_type="oneway",
                outbound_date_from=date(2026, 6, 1),
                outbound_date_to=date(2026, 6, 7),
                stops="any",
            ),
        )


def test_schema_accepts_weekly_cron():
    """Schema accepts valid weekly cron."""
    req = CreateScheduleRequest(
        name="weekly",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 7),
            stops="any",
        ),
    )
    assert req.cron_expression == "0 9 * * 1"
