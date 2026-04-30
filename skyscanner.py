import logging
from datetime import datetime

from config import Flight
from scraper import _generate_date_pairs

log = logging.getLogger(__name__)

# Skyscanner city-level place IDs for cities with multiple airports.
# For single-airport cities, lowercase IATA code is used directly.
SKYSCANNER_CITY_IDS = {
    "CDG": "pari",  # Paris – CDG + ORY
    "FCO": "rome",  # Rome – FCO + CIA
    "LHR": "lond",  # London – LHR + LGW + STN + LTN
    "MIL": "mila",  # Milan – MXP + LIN + BGY
}


def _get_place_id(iata: str) -> str:
    """Convert IATA code to Skyscanner place ID."""
    return SKYSCANNER_CITY_IDS.get(iata, iata.lower())


def _build_search_url(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str | None = None,
) -> str:
    """Build a Skyscanner search URL.

    URL format: /transport/flights/{from}/{to}/{YYMMDD}[/{YYMMDD}]/
    """
    orig = _get_place_id(origin)
    dest = _get_place_id(destination)

    dep = datetime.strptime(departure_date, "%Y-%m-%d").strftime("%y%m%d")

    if return_date:
        ret = datetime.strptime(return_date, "%Y-%m-%d").strftime("%y%m%d")
        path = f"{orig}/{dest}/{dep}/{ret}"
        rtn = "1"
    else:
        path = f"{orig}/{dest}/{dep}"
        rtn = "0"

    params = (
        f"adults=1&adultsv2=1&cabinclass=economy"
        f"&children=0&childrenv2=&infants=0"
        f"&preferdirects=false&rtn={rtn}"
    )

    return f"https://www.skyscanner.com/transport/flights/{path}/?{params}"


def search_flights(
    origin: str,
    destinations: list[str],
    date_from: str,
    date_to: str,
    return_from: str,
    return_to: str,
    stops: str = "any",
    headless: bool = True,
) -> list[Flight]:
    """Generate Skyscanner search links for each destination/date combination.

    Skyscanner blocks automated scraping (PerimeterX captcha), so we generate
    direct search URLs instead. Each URL lands on the correct Skyscanner search
    page when opened in a browser.
    """
    date_pairs = _generate_date_pairs(date_from, date_to, return_from, return_to)
    total = len(date_pairs) * len(destinations)
    log.info(f"[Skyscanner] Generating {total} search links ({len(date_pairs)} dates x {len(destinations)} destinations)")

    flights: list[Flight] = []
    for departure_date, return_date in date_pairs:
        for dest in destinations:
            url = _build_search_url(origin, dest, departure_date, return_date)
            flights.append(Flight(
                destination=dest,
                airline="—",
                departure_time="—",
                arrival_time="—",
                duration="—",
                price="Check Skyscanner",
                date=departure_date,
                stops="—",
                link=url,
                source="skyscanner",
                return_date=return_date or "",
                price_type="round trip" if return_date else "one way",
            ))

    log.info(f"[Skyscanner] Generated {len(flights)} links")
    return flights
