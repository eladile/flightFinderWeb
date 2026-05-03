import logging
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import Flight

log = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def _parse_price(price: str) -> float:
    """Extract numeric price value for sorting. Returns inf if unparseable."""
    nums = re.sub(r"[^\d.]", "", price)
    try:
        return float(nums)
    except ValueError:
        return float("inf")


def _parse_duration_minutes(duration: str) -> float:
    """Parse '15 hr 20 min' or '6 hr' into total minutes. Returns inf if unparseable."""
    hours = minutes = 0
    h = re.search(r"(\d+)\s*hr", duration)
    m = re.search(r"(\d+)\s*min", duration)
    if h:
        hours = int(h.group(1))
    if m:
        minutes = int(m.group(1))
    if not h and not m:
        return float("inf")
    return hours * 60 + minutes


def _sort_and_tag(flights: list[Flight]) -> tuple[list[Flight], set[int], set[int]]:
    """Sort flights by price (cheapest first) and identify cheapest/shortest indices."""
    sorted_flights = sorted(flights, key=lambda f: _parse_price(f.price))

    google_flights = [(i, f) for i, f in enumerate(sorted_flights) if f.source == "google"]

    cheapest = set()
    shortest = set()
    if google_flights:
        min_price = min(_parse_price(f.price) for _, f in google_flights)
        min_duration = min(_parse_duration_minutes(f.duration) for _, f in google_flights)
        if min_price != float("inf"):
            cheapest = {i for i, f in google_flights if _parse_price(f.price) == min_price}
        if min_duration != float("inf"):
            shortest = {i for i, f in google_flights if _parse_duration_minutes(f.duration) == min_duration}

    return sorted_flights, cheapest, shortest


def send_flight_alert(
    flights: list[Flight],
    smtp_email: str,
    smtp_password: str,
    email_to: str,
    origin: str,
    roundtrip: bool = False,
) -> None:
    """Send an HTML email with flight results via Gmail SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Flights found from {origin} — {len(flights)} result(s)"
    msg["From"] = smtp_email
    msg["To"] = email_to

    sorted_flights, cheapest, shortest = _sort_and_tag(flights)

    plain = _build_plain_text(sorted_flights, cheapest, shortest, origin, roundtrip)
    html = _build_html(sorted_flights, cheapest, shortest, origin, roundtrip)

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, email_to, msg.as_string())

    log.info(f"Email sent to {email_to}")


def _build_html(flights: list[Flight], cheapest: set[int], shortest: set[int], origin: str, roundtrip: bool) -> str:
    rows = ""
    for idx, f in enumerate(flights):
        stops_display = f.stops
        if f.layover_info:
            stops_display += f"<br><small style='color:#666'>{f.layover_info}</small>"

        price_display = f.price
        if f.price_type:
            price_display += f"<br><small style='color:#666'>({f.price_type})</small>"

        is_cheapest = idx in cheapest
        is_shortest = idx in shortest
        row_style = ""
        if is_cheapest and is_shortest:
            row_style = " style='background-color:#d4edda;'"
        elif is_cheapest:
            row_style = " style='background-color:#d4edda;'"
        elif is_shortest:
            row_style = " style='background-color:#d6eaf8;'"

        badges = []
        if is_cheapest:
            badges.append("<span style='background:#28a745;color:white;padding:1px 6px;border-radius:3px;font-size:0.8em;'>Cheapest</span>")
        if is_shortest:
            badges.append("<span style='background:#2196F3;color:white;padding:1px 6px;border-radius:3px;font-size:0.8em;'>Shortest</span>")
        badge_html = " ".join(badges)
        if badge_html:
            price_display = f"{badge_html}<br>{price_display}"

        row = f"<tr{row_style}>"
        row += f"<td>{f.source.title() if f.source else 'N/A'}</td>"
        row += f"<td>{f.destination}</td>"
        row += f"<td>{f.date}</td>"
        row += f"<td>{f.airline}</td>"
        row += f"<td>{f.departure_time} &rarr; {f.arrival_time}</td>"
        row += f"<td>{f.duration}</td>"
        row += f"<td>{stops_display}</td>"
        row += f"<td>{price_display}</td>"
        row += f'<td><a href="{f.link}">View</a></td>'
        row += "</tr>"
        rows += row

        if roundtrip and f.return_date:
            ret_airline = f.return_airline or "&mdash;"
            ret_times = f"{f.return_departure} &rarr; {f.return_arrival}" if f.return_departure else "&mdash;"
            ret_duration = f.return_duration or "&mdash;"
            ret_stops = f.return_stops or "&mdash;"

            ret_row = '<tr style="background-color:#eef3fc; font-size:0.9em;">'
            ret_row += '<td colspan="2" style="text-align:right; font-style:italic;">&#8617; Return:</td>'
            ret_row += f"<td>{f.return_date}</td>"
            ret_row += f"<td>{ret_airline}</td>"
            ret_row += f"<td>{ret_times}</td>"
            ret_row += f"<td>{ret_duration}</td>"
            ret_row += f"<td>{ret_stops}</td>"
            ret_row += '<td colspan="2"></td>'
            ret_row += "</tr>"
            rows += ret_row

    return f"""<!DOCTYPE html><html><head><style>
    table {{ border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
    th {{ background-color: #4472C4; color: white; }}
    tr:nth-child(even) {{ background-color: #f2f2f2; }}
    h2 {{ color: #333; }}
    small {{ font-size: 0.85em; }}
    </style></head><body>
    <h2>Flights from {origin}</h2>
    <table>
    <tr><th>Source</th><th>Dest</th><th>Date</th><th>Airline</th>
    <th>Times</th><th>Duration</th><th>Stops</th><th>Price</th><th>Link</th></tr>
    {rows}
    </table></body></html>"""


def _build_plain_text(flights: list[Flight], cheapest: set[int], shortest: set[int], origin: str, roundtrip: bool) -> str:
    lines = [f"Flights from {origin}\n"]
    for idx, f in enumerate(flights):
        source_label = f.source.title() if f.source else "N/A"
        stops_str = f.stops
        if f.layover_info:
            stops_str += f" via {f.layover_info}"
        price_str = f.price
        if f.price_type:
            price_str += f" ({f.price_type})"
        tags = []
        if idx in cheapest:
            tags.append("[CHEAPEST]")
        if idx in shortest:
            tags.append("[SHORTEST]")
        tag_str = " ".join(tags)
        if tag_str:
            tag_str = f" {tag_str}"
        line = f"  [{source_label}] {f.destination} | {f.date} | {f.airline} | {f.departure_time}-{f.arrival_time} | {f.duration} | {stops_str} | {price_str}{tag_str} | {f.link}"
        lines.append(line)
        if roundtrip and f.return_date:
            if f.return_departure:
                lines.append(f"    Return: {f.return_date} | {f.return_airline} | {f.return_departure}-{f.return_arrival} | {f.return_duration} | {f.return_stops}")
            else:
                lines.append(f"    Return: {f.return_date}")
    return "\n".join(lines)
