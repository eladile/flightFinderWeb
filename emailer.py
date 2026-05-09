import logging
import re
import smtplib
from collections import defaultdict
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import Flight

log = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

DEST_COLORS = [
    "#1a73e8", "#e8710a", "#9334e6", "#0b8043",
    "#c5221f", "#795548", "#607d8b", "#00897b",
]


def _parse_price(price: str) -> float:
    nums = re.sub(r"[^\d.]", "", price)
    try:
        return float(nums)
    except ValueError:
        return float("inf")


def _parse_duration_minutes(duration: str) -> float:
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


def _format_date_short(date_str: str) -> str:
    """'2026-05-27' -> 'May 27'"""
    try:
        from datetime import datetime
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return d.strftime("%b %-d")
    except Exception:
        return date_str


def _sort_and_tag(flights: list[Flight]) -> tuple[list[Flight], set[int], set[int]]:
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
    subject: str | None = None,
    recipients: list[str] | None = None,
) -> None:
    # Determine recipients
    if recipients is not None:
        to_list = recipients
    elif isinstance(email_to, str):
        # Support comma-separated string
        to_list = [e.strip() for e in email_to.split(",") if e.strip()]
    else:
        to_list = [email_to]

    # Determine subject
    if subject is None:
        subject = f"Flights from {origin} — {len(flights)} result(s)"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_email
    msg["To"] = ", ".join(to_list)

    sorted_flights, cheapest, shortest = _sort_and_tag(flights)

    plain = _build_plain_text(sorted_flights, cheapest, shortest, origin, roundtrip)
    html = build_html(sorted_flights, cheapest, shortest, origin, roundtrip)

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, to_list, msg.as_string())

    log.info(f"Email sent to {', '.join(to_list)}")


def build_html(flights: list[Flight], cheapest: set[int], shortest: set[int], origin: str, roundtrip: bool) -> str:
    google = [(i, f) for i, f in enumerate(flights) if f.source == "google"]
    sky = [f for f in flights if f.source == "skyscanner"]

    groups = defaultdict(list)
    for i, f in google:
        groups[f.destination].append((i, f))
    dest_order = list(groups.keys())

    dates = sorted({f.date for _, f in google}) if google else []
    date_range = f"{_format_date_short(dates[0])} &ndash; {_format_date_short(dates[-1])}" if len(dates) > 1 else (_format_date_short(dates[0]) if dates else "")
    trip_label = "Roundtrip" if roundtrip else "One way"

    body = ""

    # Header
    body += f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;font-family:-apple-system,'Segoe UI',Arial,sans-serif;">
    <tr><td style="background:linear-gradient(135deg,#1a73e8,#4285f4);border-radius:12px 12px 0 0;padding:24px 28px;">
      <div style="font-size:22px;font-weight:600;color:white;margin:0 0 4px 0;">Flights from {origin}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.85);">{len(google)} results &middot; {date_range} &middot; {trip_label}</div>
    </td></tr>"""

    # Destination groups
    for dest_idx, dest in enumerate(dest_order):
        dest_flights = groups[dest]
        color = DEST_COLORS[dest_idx % len(DEST_COLORS)]
        count = len(dest_flights)

        body += f"""
    <tr><td style="background:white;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:14px 28px 10px;border-bottom:1px solid #e8eaed;">
        <span style="font-size:18px;font-weight:700;color:{color};">{dest}</span>
        <span style="font-size:13px;color:#5f6368;margin-left:10px;">{count} flight{'s' if count != 1 else ''}</span>
      </td></tr>"""

        for orig_idx, f in dest_flights:
            is_cheapest = orig_idx in cheapest
            is_shortest = orig_idx in shortest

            border_left = ""
            bg = "white"
            if is_cheapest and is_shortest:
                border_left = "border-left:3px solid #34a853;"
                bg = "#f6fef7"
            elif is_cheapest:
                border_left = "border-left:3px solid #34a853;"
                bg = "#f6fef7"
            elif is_shortest:
                border_left = "border-left:3px solid #4285f4;"
                bg = "#f0f7ff"

            badges = ""
            if is_cheapest:
                badges += '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#34a853;color:white;margin-bottom:2px;">Cheapest</span> '
            if is_shortest:
                badges += '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#4285f4;color:white;margin-bottom:2px;">Shortest</span> '

            stops_html = f.stops
            if f.layover_info:
                stops_html += f'<br><span style="font-size:11px;color:#9aa0a6;">{f.layover_info}</span>'

            price_type_short = ""
            if f.price_type:
                price_type_short = f' <span style="font-size:11px;color:#9aa0a6;font-weight:400;">{"rt" if "round" in f.price_type else "ow"}</span>'

            body += f"""
      <tr><td style="padding:14px 28px;border-bottom:1px solid #f1f3f4;background:{bg};{border_left}">
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:55%;">
            <div style="margin-bottom:4px;">
              <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;background:#e8f0fe;color:#1a73e8;margin-right:6px;">Google</span>
              <span style="font-size:12px;color:#5f6368;">{_format_date_short(f.date)}</span>
            </div>
            <div style="margin-top:4px;">
              <span style="font-size:15px;font-weight:600;">{f.departure_time}</span>
              <span style="color:#9aa0a6;font-size:12px;"> &rarr; </span>
              <span style="font-size:15px;font-weight:600;">{f.arrival_time}</span>
            </div>
            <div style="font-size:12px;color:#5f6368;margin-top:2px;">{f.airline}</div>
          </td>
          <td style="vertical-align:top;text-align:center;width:15%;">
            <div style="font-size:13px;color:#3c4043;font-weight:500;">{f.duration}</div>
            <div style="font-size:11px;color:#9aa0a6;margin-top:1px;">{origin} &rarr; {dest}</div>
          </td>
          <td style="vertical-align:top;text-align:center;width:12%;">
            <div style="font-size:12px;color:#5f6368;">{stops_html}</div>
          </td>
          <td style="vertical-align:top;text-align:right;width:18%;">
            {f'<div>{badges}</div>' if badges else ''}
            <div style="font-size:17px;font-weight:700;color:#1a1a1a;">{f.price}{price_type_short}</div>
            <a href="{f.link}" style="font-size:12px;color:#1a73e8;text-decoration:none;font-weight:500;">View deal &rarr;</a>
          </td>
        </tr>
        </table>"""

            if roundtrip and f.return_date:
                ret_dep = f.return_departure or "&mdash;"
                ret_arr = f.return_arrival or "&mdash;"
                ret_airline = f.return_airline or "&mdash;"
                ret_dur = f.return_duration or "&mdash;"
                ret_stops = f.return_stops or "&mdash;"
                has_return = bool(f.return_departure)

                body += f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px dashed #e8eaed;padding-top:8px;">
        <tr>
          <td style="vertical-align:top;width:55%;">
            <div style="font-size:11px;color:#9aa0a6;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Return &middot; {_format_date_short(f.return_date)}</div>
            {'<div style="margin-top:2px;"><span style="font-size:14px;font-weight:600;">' + ret_dep + '</span><span style="color:#9aa0a6;font-size:12px;"> &rarr; </span><span style="font-size:14px;font-weight:600;">' + ret_arr + '</span></div><div style="font-size:12px;color:#5f6368;margin-top:1px;">' + ret_airline + '</div>' if has_return else '<div style="font-size:12px;color:#9aa0a6;font-style:italic;">Details on booking page</div>'}
          </td>
          <td style="vertical-align:top;text-align:center;width:15%;">
            {'<div style="font-size:13px;color:#3c4043;font-weight:500;">' + ret_dur + '</div><div style="font-size:11px;color:#9aa0a6;margin-top:1px;">' + dest + ' &rarr; ' + origin + '</div>' if has_return else ''}
          </td>
          <td style="vertical-align:top;text-align:center;width:12%;">
            {'<div style="font-size:12px;color:#5f6368;">' + ret_stops + '</div>' if has_return else ''}
          </td>
          <td style="width:18%;"></td>
        </tr>
        </table>"""

            body += """
      </td></tr>"""

        body += """
      </table>
    </td></tr>"""

    # Skyscanner section
    if sky:
        body += """
    <tr><td style="background:white;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:14px 28px 10px;border-bottom:1px solid #e8eaed;">
        <span style="font-size:18px;font-weight:700;color:#0b8457;">Skyscanner</span>
        <span style="font-size:13px;color:#5f6368;margin-left:10px;">Compare prices</span>
      </td></tr>"""

        for f in sky:
            body += f"""
      <tr><td style="padding:10px 28px;border-bottom:1px solid #f1f3f4;">
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;background:#e3f8f0;color:#0b8457;margin-right:6px;">Skyscanner</span>
            <span style="font-size:13px;color:#3c4043;">{f.destination} &middot; {_format_date_short(f.date)}{(' &ndash; ' + _format_date_short(f.return_date)) if f.return_date else ''}</span>
          </td>
          <td style="text-align:right;">
            <a href="{f.link}" style="font-size:13px;color:#1a73e8;text-decoration:none;font-weight:500;">Search &rarr;</a>
          </td>
        </tr>
        </table>
      </td></tr>"""

        body += """
      </table>
    </td></tr>"""

    # Footer with legend
    body += """
    <tr><td style="background:white;border-radius:0 0 12px 12px;padding:14px 28px;text-align:center;border-top:1px solid #e8eaed;">
      <span style="font-size:11px;color:#9aa0a6;">
        <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#34a853;color:white;">Cheapest</span> Lowest price
        &nbsp;&middot;&nbsp;
        <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#4285f4;color:white;">Shortest</span> Shortest flight
      </span>
    </td></tr>
    </table>"""

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f0f2f5;font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
{body}
</body></html>"""


def _build_plain_text(flights: list[Flight], cheapest: set[int], shortest: set[int], origin: str, roundtrip: bool) -> str:
    lines = [f"Flights from {origin}\n"]

    google = [(i, f) for i, f in enumerate(flights) if f.source == "google"]
    sky = [f for f in flights if f.source == "skyscanner"]

    groups = defaultdict(list)
    for i, f in google:
        groups[f.destination].append((i, f))

    for dest in groups:
        lines.append(f"\n--- {dest} ({len(groups[dest])} flights) ---")
        for idx, f in groups[dest]:
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
            tag_str = (" " + " ".join(tags)) if tags else ""
            lines.append(f"  {_format_date_short(f.date)} | {f.airline} | {f.departure_time}-{f.arrival_time} | {f.duration} | {stops_str} | {price_str}{tag_str}")
            lines.append(f"    {f.link}")
            if roundtrip and f.return_date:
                if f.return_departure:
                    lines.append(f"    Return {_format_date_short(f.return_date)}: {f.return_airline} | {f.return_departure}-{f.return_arrival} | {f.return_duration} | {f.return_stops}")
                else:
                    lines.append(f"    Return {_format_date_short(f.return_date)}")

    if sky:
        lines.append(f"\n--- Skyscanner Links ---")
        for f in sky:
            date_label = _format_date_short(f.date)
            if f.return_date:
                date_label += f" - {_format_date_short(f.return_date)}"
            lines.append(f"  {f.destination} {date_label}: {f.link}")

    return "\n".join(lines)
