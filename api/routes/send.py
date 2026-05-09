"""Email send endpoint."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.schemas import Flight as FlightSchema
from config import Flight as FlightDC, load_config
import emailer

router = APIRouter(prefix="/api/send", tags=["send"])
log = logging.getLogger(__name__)


class SendRequest(BaseModel):
    flights: list[FlightSchema]
    to: Optional[str] = None
    subject: Optional[str] = None  # Placeholder for Step 8


@router.post("")
def send_email(req: SendRequest) -> dict:
    """Send selected flights via email."""
    if not req.flights:
        raise HTTPException(status_code=400, detail="No flights provided")

    # Load SMTP config from env
    try:
        cfg = load_config()
    except SystemExit:
        raise HTTPException(status_code=500, detail="SMTP configuration missing or invalid")

    # Convert Pydantic Flight schemas to config.Flight dataclasses
    dc_flights = [
        FlightDC(
            destination=f.destination,
            airline=f.airline,
            departure_time=f.departure_time,
            arrival_time=f.arrival_time,
            duration=f.duration,
            price=f.price,
            date=f.date,
            stops=f.stops,
            return_departure=f.return_departure,
            return_arrival=f.return_arrival,
            link=f.link,
            source=f.source,
            layover_info=f.layover_info,
            return_date=f.return_date,
            price_type=f.price_type,
            return_airline=f.return_airline,
            return_duration=f.return_duration,
            return_stops=f.return_stops,
        )
        for f in req.flights
    ]

    # Determine email recipient
    email_to = req.to or cfg.email_to

    # Determine if roundtrip based on flights
    roundtrip = any(f.return_date for f in dc_flights)

    # Determine origin (use first flight's implicit origin, or default to cfg.origin)
    # For now, use cfg.origin since Flight dataclass doesn't store origin
    origin = cfg.origin

    # Send email
    try:
        emailer.send_flight_alert(
            flights=dc_flights,
            smtp_email=cfg.smtp_email,
            smtp_password=cfg.smtp_password,
            email_to=email_to,
            origin=origin,
            roundtrip=roundtrip,
        )
    except Exception as e:
        log.exception("Failed to send email")
        return {"ok": False, "error": str(e)}

    return {"ok": True, "count": len(req.flights)}
