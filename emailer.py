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
    msg["Subject"] = f"Direct flights found from {origin} — {len(flights)} result(s)"
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
        row = (
            f"<tr>"
            f"<td>{f.destination}</td>"
            f"<td>{f.date}</td>"
            f"<td>{f.airline}</td>"
            f"<td>{f.departure_time}</td>"
            f"<td>{f.arrival_time}</td>"
            f"<td>{f.duration}</td>"
        )
        if roundtrip:
            row += f"<td>{f.return_departure}</td><td>{f.return_arrival}</td>"
        row += f"<td>{f.price}</td>"
        row += f'<td><a href="{f.link}">View</a></td></tr>'
        rows += row

    return_cols = ""
    if roundtrip:
        return_cols = "<th>Return Departure</th><th>Return Arrival</th>"

    return f"""<!DOCTYPE html><html><head><style>
    table {{ border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
    th {{ background-color: #4472C4; color: white; }}
    tr:nth-child(even) {{ background-color: #f2f2f2; }}
    h2 {{ color: #333; }}
    </style></head><body>
    <h2>Direct flights from {origin}</h2>
    <table>
    <tr><th>Destination</th><th>Date</th><th>Airline</th><th>Departure</th><th>Arrival</th>
    <th>Duration</th>{return_cols}<th>Price</th><th>Link</th></tr>
    {rows}
    </table></body></html>"""


def _build_plain_text(flights: list[Flight], origin: str, roundtrip: bool) -> str:
    lines = [f"Direct flights from {origin}\n"]
    for f in flights:
        line = f"  {f.destination} | {f.date} | {f.airline} | {f.departure_time}-{f.arrival_time} | {f.duration}"
        if roundtrip and f.return_departure:
            line += f" | Return: {f.return_departure}-{f.return_arrival}"
        line += f" | {f.price} | {f.link}"
        lines.append(line)
    return "\n".join(lines)
