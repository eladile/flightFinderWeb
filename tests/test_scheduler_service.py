"""Tests for scheduler_service module."""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

import schedules
import scheduler_service
from api.schemas import CreateScheduleRequest, SearchRequest
from config import Flight as FlightDC


def test_trigger_now_records_success(tmp_schedules_path):
    """Trigger now executes the search and records success."""
    # Create a schedule
    req = CreateScheduleRequest(
        name="trigger-test",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 1),
            stops="any",
        ),
        subject="Test Subject",
        recipients=["test@example.com"],
    )
    schedules.create_schedule(req)

    # Mock search_service.run to return canned flights
    canned_flights = [
        FlightDC(
            destination="BER",
            airline="LH",
            departure_time="10:00",
            arrival_time="14:00",
            duration="4hr 0min",
            price="$200",
            date="2026-06-01",
        )
    ]

    with patch("scheduler_service.search_service.run", return_value=canned_flights) as mock_search:
        with patch("scheduler_service.emailer.send_flight_alert") as mock_email:
            run = scheduler_service.trigger_now("trigger-test")

    # Verify search was called
    assert mock_search.call_count == 1

    # Verify email was called with correct args
    assert mock_email.call_count == 1
    call_kwargs = mock_email.call_args.kwargs
    assert call_kwargs["flights"] == canned_flights
    assert call_kwargs["subject"] == "Test Subject"
    assert call_kwargs["recipients"] == ["test@example.com"]
    assert call_kwargs["roundtrip"] is False
    assert call_kwargs["origin"] == "TLV"

    # Verify run was recorded
    assert run.status == "success"
    assert run.flight_count == 1

    # Verify last_run was updated
    sched = schedules.get_schedule("trigger-test")
    assert sched is not None
    assert sched.last_run is not None
    assert sched.last_run.status == "success"


def test_trigger_now_records_failure(tmp_schedules_path):
    """Trigger now records failure when search raises."""
    req = CreateScheduleRequest(
        name="fail-test",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 1),
            stops="any",
        ),
    )
    schedules.create_schedule(req)

    # Mock search_service.run to raise
    with patch("scheduler_service.search_service.run", side_effect=RuntimeError("Boom")):
        with patch("scheduler_service.emailer.send_flight_alert") as mock_email:
            run = scheduler_service.trigger_now("fail-test")

    # Verify email was NOT called
    assert mock_email.call_count == 0

    # Verify failure was recorded
    assert run.status == "failed"
    assert "Boom" in run.error

    # Verify last_run was updated
    sched = schedules.get_schedule("fail-test")
    assert sched is not None
    assert sched.last_run is not None
    assert sched.last_run.status == "failed"


def test_trigger_now_uses_fallback_recipient(tmp_schedules_path):
    """Trigger now uses env EMAIL_TO when recipients is empty."""
    req = CreateScheduleRequest(
        name="fallback-test",
        cron_expression="0 9 * * 1",
        request=SearchRequest(
            origins=["TLV"],
            destinations=["BER"],
            trip_type="oneway",
            outbound_date_from=date(2026, 6, 1),
            outbound_date_to=date(2026, 6, 1),
            stops="any",
        ),
        recipients=[],  # Empty list
    )
    schedules.create_schedule(req)

    canned_flights = [
        FlightDC(
            destination="BER",
            airline="LH",
            departure_time="10:00",
            arrival_time="14:00",
            duration="4hr 0min",
            price="$200",
            date="2026-06-01",
        )
    ]

    with patch("scheduler_service.search_service.run", return_value=canned_flights):
        with patch("scheduler_service.emailer.send_flight_alert") as mock_email:
            scheduler_service.trigger_now("fallback-test")

    # Verify recipients is None (which triggers fallback to email_to in emailer)
    assert mock_email.call_count == 1
    call_kwargs = mock_email.call_args.kwargs
    assert call_kwargs["recipients"] is None
