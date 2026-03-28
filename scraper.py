import logging
import random
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeout

from config import Flight

log = logging.getLogger(__name__)

GOOGLE_FLIGHTS_URL = "https://www.google.com/travel/flights?hl=en&curr=EUR"
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"


def search_flights(
    origin: str,
    destinations: list[str],
    date_from: str,
    date_to: str,
    return_from: str,
    return_to: str,
    headless: bool = True,
) -> list[Flight]:
    """Search Google Flights for direct flights to each destination."""
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    all_flights: list[Flight] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="en-US",
        )
        page = context.new_page()

        for dest in destinations:
            try:
                flights = _search_destination(
                    page, origin, dest, date_from, date_to,
                    return_from, return_to,
                )
                if flights:
                    log.info(f"  Found {len(flights)} flights to {dest}")
                    all_flights.extend(flights)
                else:
                    log.info(f"  No direct flights to {dest}")
            except Exception as e:
                log.warning(f"  Error searching {dest}: {e}")
                try:
                    page.screenshot(path=str(SCREENSHOT_DIR / f"error_{dest}.png"))
                except Exception:
                    pass

            # Random delay between searches (1-3 seconds)
            time.sleep(random.uniform(1, 3))

        browser.close()

    return all_flights


def _search_destination(
    page: Page,
    origin: str,
    destination: str,
    date_from: str,
    date_to: str,
    return_from: str,
    return_to: str,
) -> list[Flight]:
    """Search flights for a single destination."""
    page.goto(GOOGLE_FLIGHTS_URL, wait_until="networkidle")

    # Dismiss cookie consent if present
    _dismiss_consent(page)

    # Set trip type to one-way if no return dates
    if not return_from:
        _set_oneway(page)

    # Fill origin
    _fill_airport(page, "Where from?", origin)

    # Fill destination
    _fill_airport(page, "Where to?", destination)

    # Set departure date
    _set_date(page, "Departure", date_from)

    # If roundtrip, set return date
    if return_from:
        _set_date(page, "Return", return_from)

    # Click search
    _click_search(page)

    # Apply nonstop filter
    _apply_nonstop_filter(page)

    # Scrape results
    return _scrape_results(page, destination)


def _dismiss_consent(page: Page):
    """Dismiss cookie consent banner if present."""
    try:
        # Google consent dialog
        accept_btn = page.locator("button:has-text('Accept all')")
        if accept_btn.count() > 0:
            accept_btn.first.click()
            page.wait_for_timeout(1000)
    except Exception:
        pass


def _set_oneway(page: Page):
    """Set trip type to one-way."""
    try:
        # Click the trip type dropdown
        trip_selector = page.locator("[aria-label='Round trip']").or_(
            page.locator("[aria-label='One way']")
        )
        if trip_selector.count() > 0:
            trip_selector.first.click()
            page.wait_for_timeout(500)
            # Select "One way" from dropdown
            oneway_option = page.locator("li:has-text('One way')")
            if oneway_option.count() > 0:
                oneway_option.first.click()
                page.wait_for_timeout(500)
    except Exception as e:
        log.debug(f"Could not set one-way: {e}")


def _fill_airport(page: Page, label: str, code: str):
    """Fill in an airport input field."""
    input_field = page.locator(f"input[aria-label='{label}']").or_(
        page.locator(f"input[placeholder='{label}']")
    )
    input_field.first.click()
    page.wait_for_timeout(300)

    # Clear existing text and type the code
    input_field.first.fill("")
    input_field.first.type(code, delay=50)
    page.wait_for_timeout(1000)

    # Click the first suggestion in the dropdown
    suggestion = page.locator("li[role='option']").or_(
        page.locator("[data-value] li").first
    )
    if suggestion.count() > 0:
        suggestion.first.click()
        page.wait_for_timeout(500)
    else:
        # Press Enter to confirm
        input_field.first.press("Enter")
        page.wait_for_timeout(500)


def _set_date(page: Page, label: str, date_str: str):
    """Set a date using the date picker. date_str is YYYY-MM-DD."""
    try:
        date_input = page.locator(f"input[aria-label*='{label}']")
        if date_input.count() > 0:
            date_input.first.click()
            page.wait_for_timeout(500)

            # Try selecting the date via data-iso attribute in calendar
            date_cell = page.locator(f"[data-iso='{date_str}']")
            if date_cell.count() > 0:
                date_cell.first.click()
                page.wait_for_timeout(300)
            else:
                # Fallback: clear and type the date
                date_input.first.fill("")
                # Format as displayed (e.g., "Apr 1" or "Mon, Apr 1")
                from datetime import datetime
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                formatted = dt.strftime("%b %-d")
                date_input.first.type(formatted, delay=50)
                page.wait_for_timeout(500)
                date_input.first.press("Enter")

            # Click "Done" button if present
            done_btn = page.locator("button:has-text('Done')")
            if done_btn.count() > 0:
                done_btn.first.click()
                page.wait_for_timeout(300)
    except Exception as e:
        log.debug(f"Could not set date for {label}: {e}")


def _click_search(page: Page):
    """Click the search/explore button."""
    search_btn = page.locator("button[aria-label='Search']").or_(
        page.locator("button[aria-label*='Search']")
    ).or_(
        page.locator("button:has-text('Search')")
    ).or_(
        page.locator("button:has-text('Explore')")
    )

    if search_btn.count() > 0:
        search_btn.first.click()
    else:
        # Fallback: press Enter
        page.keyboard.press("Enter")

    # Wait for results to load
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeout:
        pass
    page.wait_for_timeout(2000)


def _apply_nonstop_filter(page: Page):
    """Apply the nonstop-only stops filter."""
    try:
        # Look for the "Stops" filter button/dropdown
        stops_btn = page.locator("button:has-text('Stops')").or_(
            page.locator("[aria-label*='stops']").or_(
                page.locator("span:has-text('Stops')")
            )
        )

        if stops_btn.count() > 0:
            stops_btn.first.click()
            page.wait_for_timeout(500)

            # Select "Nonstop only"
            nonstop = page.locator("label:has-text('Nonstop only')").or_(
                page.locator("li:has-text('Nonstop only')")
            ).or_(
                page.locator("[aria-label*='Nonstop only']")
            )
            if nonstop.count() > 0:
                nonstop.first.click()
                page.wait_for_timeout(500)

            # Close the filter dropdown
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


def _scrape_results(page: Page, destination: str) -> list[Flight]:
    """Scrape flight results from the current page."""
    flights: list[Flight] = []

    # Wait for flight result cards
    try:
        page.wait_for_selector("li.pIav2d", timeout=10000)
    except PlaywrightTimeout:
        # No results found
        return flights

    result_cards = page.locator("li.pIav2d")
    count = min(result_cards.count(), 20)

    for i in range(count):
        try:
            card = result_cards.nth(i)
            flight = _parse_flight_card(card, destination)
            if flight:
                flights.append(flight)
        except Exception as e:
            log.debug(f"Could not parse flight card {i}: {e}")

    return flights


def _parse_flight_card(card, destination: str) -> Flight | None:
    """Parse a single flight result card into a Flight object."""
    try:
        # Airline
        airline_el = card.locator("div.sSHqwe").or_(card.locator("[data-test-id='airline']"))
        airline = airline_el.first.inner_text().strip() if airline_el.count() > 0 else "Unknown"

        # Departure time
        dep_el = card.locator("span[aria-label^='Departure time']")
        departure_time = dep_el.first.inner_text().strip() if dep_el.count() > 0 else ""

        # Arrival time
        arr_el = card.locator("span[aria-label^='Arrival time']")
        arrival_time = arr_el.first.inner_text().strip() if arr_el.count() > 0 else ""

        # Duration
        dur_el = card.locator("div[aria-label^='Total duration']")
        duration = dur_el.first.inner_text().strip() if dur_el.count() > 0 else ""

        # Price
        price_el = card.locator("div.FpEdX span").or_(card.locator("[data-test-id='price']"))
        price = price_el.first.inner_text().strip() if price_el.count() > 0 else ""

        # Date (from the page context, not the card)
        date = ""

        if not departure_time and not price:
            return None

        return Flight(
            destination=destination,
            airline=airline,
            departure_time=departure_time,
            arrival_time=arrival_time,
            duration=duration,
            price=price,
            date=date,
        )
    except Exception:
        return None
