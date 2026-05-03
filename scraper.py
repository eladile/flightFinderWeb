import base64
import logging
import random
import time
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeout

from config import Flight

log = logging.getLogger(__name__)

SCREENSHOT_DIR = Path(__file__).parent / "screenshots"

# Freebase/Knowledge Graph city IDs used by Google Flights.
# Decoded from working Google Flights URLs — these are stable (Freebase frozen since 2016).
CITY_KG_IDS = {
    "TLV": "/m/07qzv",   # Tel Aviv
    "AMS": "/m/0k3p",    # Amsterdam
    "ATH": "/m/0n2z",    # Athens
    "BCN": "/m/01f62",   # Barcelona
    "BER": "/m/0156q",   # Berlin
    "BRU": "/m/0177z",   # Brussels
    "BUD": "/m/095w_",   # Budapest
    "CDG": "/m/05qtj",   # Paris
    "CPH": "/m/01lfy",   # Copenhagen
    "FCO": "/m/06c62",   # Rome
    "LHR": "/m/04jpl",   # London
    "LIS": "/m/04llb",   # Lisbon
    "MAD": "/m/056_y",   # Madrid
    "MIL": "/m/0947l",   # Milan
    "MUC": "/m/02h6_6p", # Munich
    "OSL": "/m/05l64",   # Oslo
    "PRG": "/m/05ywg",   # Prague
    "SOF": "/m/0ftjx",   # Sofia
    "VIE": "/m/0fhp9",   # Vienna
    "WAW": "/m/081m_",   # Warsaw
    "ZRH": "/m/08966",   # Zurich
}


# --- Protobuf helpers (minimal, just enough for Google Flights tfs param) ---

def _pb_varint(value: int) -> bytes:
    """Encode an unsigned integer as a protobuf varint."""
    result = bytearray()
    while value > 127:
        result.append((value & 0x7F) | 0x80)
        value >>= 7
    result.append(value & 0x7F)
    return bytes(result)


def _pb_field_varint(field: int, value: int) -> bytes:
    tag = _pb_varint((field << 3) | 0)
    return tag + _pb_varint(value)


def _pb_field_bytes(field: int, data: bytes) -> bytes:
    tag = _pb_varint((field << 3) | 2)
    return tag + _pb_varint(len(data)) + data


def _pb_field_string(field: int, value: str) -> bytes:
    return _pb_field_bytes(field, value.encode("utf-8"))


def _build_search_url(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str | None = None,
    currency: str = "EUR",
) -> str:
    """Build a Google Flights search URL using protobuf-encoded tfs parameter.

    Matches the structure decoded from working Google Flights URLs:
      field 1=28, field 2=num_legs, field 3=slice(s), plus flags 8,9,14,16,19.
    """
    origin_kg = CITY_KG_IDS.get(origin)
    dest_kg = CITY_KG_IDS.get(destination)

    # Place type 2 = city (KG ID), type 1 = airport (IATA code)
    if origin_kg:
        origin_place = _pb_field_varint(1, 2) + _pb_field_string(2, origin_kg)
    else:
        origin_place = _pb_field_varint(1, 1) + _pb_field_string(2, origin)

    if dest_kg:
        dest_place = _pb_field_varint(1, 2) + _pb_field_string(2, dest_kg)
    else:
        dest_place = _pb_field_varint(1, 1) + _pb_field_string(2, destination)

    # Outbound slice: field 2 = date, field 13 = origin, field 14 = dest
    outbound = (
        _pb_field_string(2, departure_date)
        + _pb_field_bytes(13, origin_place)
        + _pb_field_bytes(14, dest_place)
    )

    if return_date:
        # Return slice: origin/dest swapped
        return_slice = (
            _pb_field_string(2, return_date)
            + _pb_field_bytes(13, dest_place)
            + _pb_field_bytes(14, origin_place)
        )
        tfs = (
            _pb_field_varint(1, 28)
            + _pb_field_varint(2, 2)
            + _pb_field_bytes(3, outbound)
            + _pb_field_bytes(3, return_slice)
            + _pb_field_varint(8, 1)
            + _pb_field_varint(9, 1)
            + _pb_field_varint(14, 1)
            + _pb_field_bytes(16, _pb_field_varint(1, (1 << 64) - 1))
            + _pb_field_varint(19, 1)
        )
    else:
        tfs = (
            _pb_field_varint(1, 28)
            + _pb_field_varint(2, 2)
            + _pb_field_bytes(3, outbound)
            + _pb_field_varint(8, 1)
            + _pb_field_varint(9, 1)
            + _pb_field_varint(14, 1)
            + _pb_field_bytes(16, _pb_field_varint(1, (1 << 64) - 1))
            + _pb_field_varint(19, 2)
        )

    encoded = base64.urlsafe_b64encode(tfs).rstrip(b"=").decode("ascii")
    return f"https://www.google.com/travel/flights/search?tfs={encoded}&hl=en&curr={currency}"


def _generate_date_pairs(
    outbound_from: str,
    outbound_to: str,
    return_from: str,
    return_to: str,
) -> list[tuple[str, str | None]]:
    """Generate (departure_date, return_date) pairs to search.

    For one-way: yields (date, None) for each day in outbound range.
    For roundtrip: yields (date, return_date) with a fixed offset from
    outbound_from to return_from, capped at return_to.
    """
    fmt = "%Y-%m-%d"
    start = datetime.strptime(outbound_from, fmt)
    end = datetime.strptime(outbound_to, fmt)

    if not return_from:
        pairs = []
        current = start
        while current <= end:
            pairs.append((current.strftime(fmt), None))
            current += timedelta(days=1)
        return pairs

    ret_start = datetime.strptime(return_from, fmt)
    ret_end = datetime.strptime(return_to, fmt)
    offset = (ret_start - start).days

    pairs = []
    current = start
    while current <= end:
        ret_date = current + timedelta(days=offset)
        if ret_date > ret_end:
            ret_date = ret_end
        if ret_date > current:
            pairs.append((current.strftime(fmt), ret_date.strftime(fmt)))
        current += timedelta(days=1)
    return pairs


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
    """Search Google Flights for flights, iterating over dates and destinations."""
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    all_flights: list[Flight] = []

    date_pairs = _generate_date_pairs(date_from, date_to, return_from, return_to)
    total = len(date_pairs) * len(destinations)
    log.info(f"Planning {total} searches ({len(date_pairs)} dates x {len(destinations)} destinations)")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="en-US",
        )
        page = context.new_page()

        search_num = 0
        for departure_date, return_date in date_pairs:
            for dest in destinations:
                search_num += 1
                try:
                    label = f"{origin}->{dest} on {departure_date}"
                    if return_date:
                        label += f" ret {return_date}"
                    log.info(f"  [{search_num}/{total}] {label}")

                    flights = _search_single(page, origin, dest, departure_date, return_date, stops)
                    if flights:
                        log.info(f"    Found {len(flights)} flights")
                        all_flights.extend(flights)
                    else:
                        log.info(f"    No flights")
                except Exception as e:
                    log.warning(f"    Error: {e}")
                    try:
                        page.screenshot(path=str(SCREENSHOT_DIR / f"error_{dest}_{departure_date}.png"))
                    except Exception:
                        pass

                time.sleep(random.uniform(1, 3))

        browser.close()

    return all_flights


def _count_stops(stops_text: str) -> int:
    """Parse stop count from Google Flights text like 'Nonstop', '1 stop', '2 stops'."""
    text = stops_text.strip().lower()
    if not text or "nonstop" in text:
        return 0
    for word in text.split():
        if word.isdigit():
            return int(word)
    return 999


def _search_single(
    page: Page,
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str | None,
    stops: str = "any",
) -> list[Flight]:
    """Search flights for a single destination on a single date via URL navigation."""
    url = _build_search_url(origin, destination, departure_date, return_date)
    page.goto(url, wait_until="networkidle")

    _dismiss_consent(page)

    # Wait for results to load
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeout:
        pass
    page.wait_for_timeout(2000)

    if stops == "nonstop":
        _apply_nonstop_filter(page)

    flights = _scrape_results(page, destination, departure_date, return_date, url)

    if stops.isdigit():
        max_stops = int(stops)
        flights = [f for f in flights if _count_stops(f.stops) <= max_stops]

    return flights


def _dismiss_consent(page: Page):
    """Dismiss cookie consent banner if present."""
    try:
        accept_btn = page.locator("button:has-text('Accept all')")
        if accept_btn.count() > 0:
            accept_btn.first.click()
            page.wait_for_timeout(1000)
    except Exception:
        pass


def _apply_nonstop_filter(page: Page):
    """Apply the nonstop-only stops filter."""
    try:
        stops_btn = page.locator("button:has-text('Stops')").or_(
            page.locator("[aria-label*='stops']").or_(
                page.locator("span:has-text('Stops')")
            )
        )

        if stops_btn.count() > 0:
            stops_btn.first.click()
            page.wait_for_timeout(500)

            nonstop = page.locator("label:has-text('Nonstop only')").or_(
                page.locator("li:has-text('Nonstop only')")
            ).or_(
                page.locator("[aria-label*='Nonstop only']")
            )
            if nonstop.count() > 0:
                nonstop.first.click()
                page.wait_for_timeout(500)

            close_btn = page.locator("button:has-text('Close')").or_(
                page.locator("button[aria-label='Close']")
            )
            if close_btn.count() > 0:
                close_btn.first.click()
            else:
                page.keyboard.press("Escape")

            page.wait_for_timeout(1000)
    except Exception as e:
        log.debug(f"Could not apply nonstop filter: {e}")


RETURN_TOP_N = 5


def _scrape_results(page: Page, destination: str, departure_date: str, return_date: str | None, link: str) -> list[Flight]:
    """Scrape flight results from the current page."""
    flights: list[Flight] = []

    try:
        page.wait_for_selector("li.pIav2d", timeout=10000)
    except PlaywrightTimeout:
        return flights

    result_cards = page.locator("li.pIav2d")
    count = min(result_cards.count(), 20)

    for i in range(count):
        try:
            card = result_cards.nth(i)
            flight = _parse_flight_card(card, destination, departure_date, return_date, link)
            if flight:
                flights.append(flight)
        except Exception as e:
            log.debug(f"Could not parse flight card {i}: {e}")

    if return_date and flights:
        _scrape_return_details(page, flights)

    return flights


def _scrape_return_details(page: Page, flights: list[Flight]) -> None:
    """Click 'Select flight' on top N outbound cards and scrape the best return flight."""
    original_url = page.url
    n = min(RETURN_TOP_N, len(flights))
    for i in range(n):
        try:
            cards = page.locator("li.pIav2d")
            if cards.count() <= i:
                log.debug(f"Return scrape {i}: only {cards.count()} cards on page")
                break

            card = cards.nth(i)
            select_el = card.locator("div.JMc5Xc[role='link']")
            if select_el.count() == 0:
                select_el = card.locator("button[aria-label='Select flight']")
            if select_el.count() == 0:
                log.debug(f"Return scrape {i}: no clickable element found")
                continue

            select_el.first.click(force=True)

            try:
                page.wait_for_url(lambda url: url != original_url, timeout=10000)
                page.wait_for_selector("li.pIav2d", timeout=10000)
                page.wait_for_timeout(1500)
            except PlaywrightTimeout:
                log.debug(f"Return scrape {i}: timeout waiting for return page")
                page.goto(original_url, wait_until="networkidle")
                page.wait_for_timeout(2000)
                continue

            return_page_url = page.url

            return_card = page.locator("li.pIav2d").first
            ret = _parse_return_card(return_card)
            if ret:
                flights[i].return_departure = ret["departure"]
                flights[i].return_arrival = ret["arrival"]
                flights[i].return_airline = ret["airline"]
                flights[i].return_duration = ret["duration"]
                flights[i].return_stops = ret["stops"]
                log.debug(f"Return scrape {i}: {ret['airline']} {ret['departure']}-{ret['arrival']}")

                ret_select = return_card.locator("div.JMc5Xc[role='link']")
                if ret_select.count() == 0:
                    ret_select = return_card.locator("button[aria-label='Select flight']")
                if ret_select.count() > 0:
                    ret_select.first.click(force=True)
                    try:
                        page.wait_for_url(lambda url: url != return_page_url, timeout=10000)
                        flights[i].link = page.url
                    except PlaywrightTimeout:
                        flights[i].link = return_page_url
                else:
                    flights[i].link = return_page_url
            else:
                log.debug(f"Return scrape {i}: could not parse return card")
                flights[i].link = return_page_url

            page.goto(original_url, wait_until="networkidle")
            page.wait_for_timeout(2000)

        except Exception as e:
            log.debug(f"Could not scrape return for flight {i}: {e}")
            try:
                page.goto(original_url, wait_until="networkidle")
                page.wait_for_timeout(2000)
            except Exception:
                pass


def _parse_return_card(card) -> dict | None:
    """Parse departure, arrival, airline, duration, stops from a return flight card."""
    try:
        dep_el = card.locator("span[aria-label^='Departure time']")
        departure = dep_el.first.inner_text().strip() if dep_el.count() > 0 else ""

        arr_el = card.locator("span[aria-label^='Arrival time']")
        arrival = arr_el.first.inner_text().strip() if arr_el.count() > 0 else ""

        airline_el = card.locator("div.sSHqwe").or_(card.locator("[data-test-id='airline']"))
        airline = airline_el.first.inner_text().strip() if airline_el.count() > 0 else ""

        dur_el = card.locator("div[aria-label^='Total duration']")
        duration = dur_el.first.inner_text().strip() if dur_el.count() > 0 else ""

        stops_el = card.locator("div.EfT7Ae span.ogfYpf")
        if stops_el.count() > 0:
            stops = stops_el.first.inner_text().strip()
        else:
            stops_el = card.locator("span:has-text('stop')").or_(card.locator("span:has-text('Nonstop')"))
            stops = stops_el.first.inner_text().strip() if stops_el.count() > 0 else ""

        if not departure:
            return None

        return {"departure": departure, "arrival": arrival, "airline": airline, "duration": duration, "stops": stops}
    except Exception:
        return None


def _parse_flight_card(card, destination: str, departure_date: str, return_date: str | None, link: str) -> Flight | None:
    """Parse a single flight result card into a Flight object."""
    try:
        airline_el = card.locator("div.sSHqwe").or_(card.locator("[data-test-id='airline']"))
        airline = airline_el.first.inner_text().strip() if airline_el.count() > 0 else "Unknown"

        dep_el = card.locator("span[aria-label^='Departure time']")
        departure_time = dep_el.first.inner_text().strip() if dep_el.count() > 0 else ""

        arr_el = card.locator("span[aria-label^='Arrival time']")
        arrival_time = arr_el.first.inner_text().strip() if arr_el.count() > 0 else ""

        dur_el = card.locator("div[aria-label^='Total duration']")
        duration = dur_el.first.inner_text().strip() if dur_el.count() > 0 else ""

        stops_el = card.locator("div.EfT7Ae span.ogfYpf")
        if stops_el.count() > 0:
            stops = stops_el.first.inner_text().strip()
        else:
            stops_el = card.locator("span:has-text('stop')").or_(card.locator("span:has-text('Nonstop')"))
            stops = stops_el.first.inner_text().strip() if stops_el.count() > 0 else ""

        layover_info = ""
        if stops and "nonstop" not in stops.lower():
            layover_el = card.locator("div.BbR8Ec > div.sSHqwe[aria-label*='ayover']")
            if layover_el.count() > 0:
                layover_info = layover_el.first.inner_text().strip()
            else:
                stops_area = card.locator("div.BbR8Ec")
                if stops_area.count() > 0:
                    full_text = stops_area.first.inner_text().strip()
                    lines = full_text.split("\n")
                    if len(lines) > 1:
                        layover_info = lines[1].strip()

        price_el = card.locator("div.FpEdX span").or_(card.locator("[data-test-id='price']"))
        price = price_el.first.inner_text().strip() if price_el.count() > 0 else ""

        price_type = ""
        price_type_el = card.locator("div.N872Rd")
        if price_type_el.count() > 0:
            price_type = price_type_el.first.inner_text().strip().lower()
        if not price_type and return_date:
            price_type = "round trip"

        if not departure_time or not price or "unavailable" in price.lower():
            return None

        return Flight(
            destination=destination,
            airline=airline,
            departure_time=departure_time,
            arrival_time=arrival_time,
            duration=duration,
            price=price,
            date=departure_date,
            stops=stops,
            link=link,
            source="google",
            layover_info=layover_info,
            return_date=return_date or "",
            price_type=price_type,
        )
    except Exception:
        return None
