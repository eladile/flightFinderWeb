"""Tests for emailer module."""

from unittest.mock import MagicMock, patch

import pytest

from config import Flight
import emailer


def test_build_html_smoke():
    """build_html returns HTML containing destination and price."""
    flights = [
        Flight(
            destination="BER",
            airline="LH",
            departure_time="10:00",
            arrival_time="14:00",
            duration="4hr 0min",
            price="$200",
            date="2026-06-01",
            source="google",
        )
    ]
    sorted_flights, cheapest, shortest = emailer._sort_and_tag(flights)
    html = emailer.build_html(sorted_flights, cheapest, shortest, "TLV", False)

    assert "BER" in html
    assert "$200" in html
    assert "TLV" in html


def test_send_alert_uses_custom_subject_and_recipients():
    """send_flight_alert uses custom subject and recipients when provided."""
    flights = [
        Flight(
            destination="BER",
            airline="LH",
            departure_time="10:00",
            arrival_time="14:00",
            duration="4hr 0min",
            price="$200",
            date="2026-06-01",
            source="google",
        )
    ]

    mock_smtp_instance = MagicMock()
    mock_smtp_class = MagicMock(return_value=mock_smtp_instance)
    mock_smtp_instance.__enter__ = MagicMock(return_value=mock_smtp_instance)
    mock_smtp_instance.__exit__ = MagicMock(return_value=False)

    with patch("emailer.smtplib.SMTP", mock_smtp_class):
        emailer.send_flight_alert(
            flights=flights,
            smtp_email="test@example.com",
            smtp_password="password",
            email_to="default@example.com",
            origin="TLV",
            roundtrip=False,
            subject="Custom Subject",
            recipients=["recipient1@example.com", "recipient2@example.com"],
        )

        # Verify SMTP methods were called
        assert mock_smtp_instance.starttls.call_count == 1
        assert mock_smtp_instance.login.call_count == 1
        assert mock_smtp_instance.sendmail.call_count == 1

        # Verify sendmail was called with correct recipients
        call_args = mock_smtp_instance.sendmail.call_args[0]
        assert call_args[0] == "test@example.com"
        assert call_args[1] == ["recipient1@example.com", "recipient2@example.com"]

        # Verify message contains custom subject
        msg_str = call_args[2]
        assert "Subject: Custom Subject" in msg_str
        assert "To: recipient1@example.com, recipient2@example.com" in msg_str
