import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import Flight

log = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


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

    plain = _build_plain_text(flights, origin, roundtrip)
    html = _build_html(flights, origin, roundtrip)

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, email_to, msg.as_string())

    log.info(f"Email sent to {email_to}")


def _build_html(flights: list[Flight], origin: str, roundtrip: bool) -> str:
    rows = ""
    for f in flights:
        stops_display = f.stops
        if f.layover_info:
            stops_display += f"<br><small style='color:#666'>{f.layover_info}</small>"

        price_display = f.price
        if f.price_type:
            price_display += f"<br><small style='color:#666'>({f.price_type})</small>"

        row = "<tr>"
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
            ret_row = '<tr style="background-color:#eef3fc; font-size:0.9em;">'
            ret_row += '<td colspan="2" style="text-align:right; font-style:italic;">&#8617; Return:</td>'
            ret_row += f"<td>{f.return_date}</td>"
            ret_row += "<td>&mdash;</td>"
            ret_row += "<td>&mdash;</td>"
            ret_row += "<td>&mdash;</td>"
            ret_row += "<td>&mdash;</td>"
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


def _build_plain_text(flights: list[Flight], origin: str, roundtrip: bool) -> str:
    lines = [f"Flights from {origin}\n"]
    for f in flights:
        source_label = f.source.title() if f.source else "N/A"
        stops_str = f.stops
        if f.layover_info:
            stops_str += f" via {f.layover_info}"
        price_str = f.price
        if f.price_type:
            price_str += f" ({f.price_type})"
        line = f"  [{source_label}] {f.destination} | {f.date} | {f.airline} | {f.departure_time}-{f.arrival_time} | {f.duration} | {stops_str} | {price_str} | {f.link}"
        lines.append(line)
        if roundtrip and f.return_date:
            lines.append(f"    Return: {f.return_date}")
    return "\n".join(lines)
