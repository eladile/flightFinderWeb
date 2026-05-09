"""Tests for FastAPI endpoints."""

import base64
import json
from datetime import date
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.schemas import (
    DoneEvent,
    Flight,
    FlightEvent,
    JobCompletedEvent,
    JobStartedEvent,
    PlanEvent,
    SearchJob,
    SearchRequest,
)

client = TestClient(app)


def test_health():
    """GET /api/health returns status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_airports_search_by_code():
    """GET /api/airports/search?q=BER returns results with BER first."""
    response = client.get("/api/airports/search", params={"q": "BER"})
    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert results[0]["iata"] == "BER"


def test_airports_search_empty_query():
    """GET /api/airports/search?q= returns empty list."""
    response = client.get("/api/airports/search", params={"q": ""})
    assert response.status_code == 200
    assert response.json() == []


def test_airports_search_limit_capped():
    """Limit is capped at 50 (validation rejects >50)."""
    # Try with limit > 50, should get 422
    response = client.get("/api/airports/search", params={"q": "a", "limit": 1000})
    assert response.status_code == 422

    # Try with limit = 50, should work
    response = client.get("/api/airports/search", params={"q": "a", "limit": 50})
    assert response.status_code == 200
    results = response.json()
    assert len(results) <= 50


def test_send_rejects_no_flights():
    """POST /api/send with empty flights list returns 400."""
    response = client.post("/api/send", json={"flights": []})
    assert response.status_code == 400
    assert "No flights" in response.json()["detail"]


def test_search_sse_stream():
    """GET /api/search streams SSE events in order."""
    # Build a SearchRequest
    req = SearchRequest(
        origins=["TLV"],
        destinations=["BER"],
        trip_type="oneway",
        outbound_date_from=date(2026, 6, 1),
        outbound_date_to=date(2026, 6, 1),
        stops="any",
        providers=["google"],
    )
    req_json = req.model_dump_json()
    req_b64 = base64.b64encode(req_json.encode()).decode()

    # Mock search_service.run_streaming to yield canned events
    canned_events = [
        PlanEvent(
            total_jobs=1,
            jobs=[
                SearchJob(
                    id="j1",
                    origin="TLV",
                    destination="BER",
                    outbound_date=date(2026, 6, 1),
                    stops="any",
                    providers=["google"],
                )
            ],
        ),
        JobStartedEvent(job_id="j1"),
        FlightEvent(
            job_id="j1",
            flight=Flight(
                destination="BER",
                airline="LH",
                departure_time="10:00",
                arrival_time="14:00",
                duration="4hr 0min",
                price="$200",
                date="2026-06-01",
            ),
        ),
        JobCompletedEvent(job_id="j1", flight_count=1),
        DoneEvent(total_flights=1, failed_jobs=0),
    ]

    with patch("api.routes.search.search_service.run_streaming", return_value=iter(canned_events)):
        with client.stream("GET", "/api/search", params={"q": req_b64}) as response:
            assert response.status_code == 200
            lines = list(response.iter_lines())

    # Concatenate lines into raw SSE text
    body = "\n".join(str(line) for line in lines)

    # Check that all expected event types appear
    assert "event: search_id" in body
    assert "event: plan" in body
    assert "event: job_started" in body
    assert "event: flight" in body
    assert "event: job_completed" in body
    assert "event: done" in body


def test_search_cancel():
    """DELETE /api/search/{search_id} returns cancelled status."""
    # Attempt to cancel a non-existent search
    response = client.delete("/api/search/fake_id")
    assert response.status_code == 200
    assert response.json() == {"cancelled": False}


def test_send_uses_custom_subject():
    """POST /api/send with custom subject passes it to emailer."""
    flight = Flight(
        destination="BER",
        airline="LH",
        departure_time="10:00",
        arrival_time="14:00",
        duration="4hr 0min",
        price="$200",
        date="2026-06-01",
    )

    with patch("api.routes.send.emailer.send_flight_alert") as mock_send:
        response = client.post(
            "/api/send",
            json={
                "flights": [flight.model_dump(by_alias=True)],
                "subject": "Custom Subject Line",
            },
        )
        assert response.status_code == 200
        assert response.json()["ok"] is True

        # Verify emailer was called with custom subject
        assert mock_send.call_count == 1
        call_kwargs = mock_send.call_args.kwargs
        assert call_kwargs["subject"] == "Custom Subject Line"


def test_send_uses_custom_recipient():
    """POST /api/send with custom recipient passes it to emailer."""
    flight = Flight(
        destination="BER",
        airline="LH",
        departure_time="10:00",
        arrival_time="14:00",
        duration="4hr 0min",
        price="$200",
        date="2026-06-01",
    )

    with patch("api.routes.send.emailer.send_flight_alert") as mock_send:
        response = client.post(
            "/api/send",
            json={
                "flights": [flight.model_dump(by_alias=True)],
                "to": "custom@example.com, another@example.com",
            },
        )
        assert response.status_code == 200
        assert response.json()["ok"] is True

        # Verify emailer was called with custom recipients
        assert mock_send.call_count == 1
        call_kwargs = mock_send.call_args.kwargs
        assert call_kwargs["recipients"] == ["custom@example.com", "another@example.com"]


def test_send_preview_returns_html():
    """POST /api/send/preview returns HTML."""
    flight = Flight(
        destination="BER",
        airline="LH",
        departure_time="10:00",
        arrival_time="14:00",
        duration="4hr 0min",
        price="$200",
        date="2026-06-01",
    )

    with patch("api.routes.send.emailer.build_html", return_value="<p>mocked</p>"):
        response = client.post(
            "/api/send/preview",
            json={"flights": [flight.model_dump(by_alias=True)]},
        )
        assert response.status_code == 200
        data = response.json()
        assert "html" in data
        assert data["html"] == "<p>mocked</p>"


def test_config_email_to():
    """GET /api/config/email_to returns the configured recipient."""
    response = client.get("/api/config/email_to")
    assert response.status_code == 200
    data = response.json()
    assert "emailTo" in data
