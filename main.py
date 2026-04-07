#!/usr/bin/env python3
"""flightFinderWeb — scrape flight search engines and send email alerts."""

import logging
import sys

from config import load_config
import scraper
import skyscanner
from emailer import send_flight_alert

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def main():
    cfg = load_config()
    roundtrip = cfg.trip_type == "roundtrip"

    log.info(
        f"Searching {len(cfg.destinations)} destinations from {cfg.origin} "
        f"({cfg.outbound_from} to {cfg.outbound_to}, trip: {cfg.trip_type}, "
        f"stops: {cfg.stops}, providers: {','.join(cfg.providers)})"
    )

    search_kwargs = dict(
        origin=cfg.origin,
        destinations=cfg.destinations,
        date_from=cfg.outbound_from,
        date_to=cfg.outbound_to,
        return_from=cfg.return_from if roundtrip else "",
        return_to=cfg.return_to if roundtrip else "",
        stops=cfg.stops,
        headless=cfg.headless,
    )

    flights = []
    for provider in cfg.providers:
        if provider == "google":
            flights.extend(scraper.search_flights(**search_kwargs))
        elif provider == "skyscanner":
            flights.extend(skyscanner.search_flights(**search_kwargs))

    log.info(f"Search complete: {len(flights)} flights found")

    if not flights:
        log.info("No flights found. No email sent.")
        sys.exit(0)

    send_flight_alert(
        flights=flights,
        smtp_email=cfg.smtp_email,
        smtp_password=cfg.smtp_password,
        email_to=cfg.email_to,
        origin=cfg.origin,
        roundtrip=roundtrip,
    )

    print(f"Email sent to {cfg.email_to} with {len(flights)} flight(s)")


if __name__ == "__main__":
    main()
