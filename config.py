import os
import sys
from dataclasses import dataclass, field
from datetime import datetime

EUROPE_AIRPORTS = [
    "AMS", "ATH", "BCN", "BER", "BRU", "BUD", "CDG", "CPH",
    "FCO", "LHR", "LIS", "MAD", "MIL", "MUC", "OSL", "PRG",
    "SOF", "VIE", "WAW", "ZRH",
]


@dataclass
class Flight:
    destination: str
    airline: str
    departure_time: str
    arrival_time: str
    duration: str
    price: str
    date: str
    stops: str = "Nonstop"
    return_departure: str = ""
    return_arrival: str = ""
    link: str = ""
    source: str = ""
    layover_info: str = ""
    return_date: str = ""
    price_type: str = ""


@dataclass
class Config:
    smtp_email: str
    smtp_password: str
    email_to: str
    origin: str
    destinations: list[str]
    outbound_from: str
    outbound_to: str
    return_from: str = ""
    return_to: str = ""
    trip_type: str = "oneway"
    stops: str = "any"
    providers: list[str] = field(default_factory=lambda: ["google", "skyscanner"])
    headless: bool = True


def load_config() -> Config:
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    required = {
        "SMTP_EMAIL": os.getenv("SMTP_EMAIL", ""),
        "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD", ""),
        "EMAIL_TO": os.getenv("EMAIL_TO", ""),
        "OUTBOUND_FROM": os.getenv("OUTBOUND_FROM", ""),
        "OUTBOUND_TO": os.getenv("OUTBOUND_TO", ""),
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        print(f"Error: missing required env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    trip_type = os.getenv("TRIP_TYPE", "oneway").lower()
    if trip_type not in ("oneway", "roundtrip"):
        print(f"Error: TRIP_TYPE must be 'oneway' or 'roundtrip', got '{trip_type}'", file=sys.stderr)
        sys.exit(1)

    stops = os.getenv("STOPS", "any").lower()
    if stops not in ("any", "nonstop") and not stops.isdigit():
        print(f"Error: STOPS must be 'any', 'nonstop', or a number (e.g. '1'), got '{stops}'", file=sys.stderr)
        sys.exit(1)

    return_from = os.getenv("RETURN_FROM", "")
    return_to = os.getenv("RETURN_TO", "")
    if trip_type == "roundtrip" and (not return_from or not return_to):
        print("Error: RETURN_FROM and RETURN_TO required when TRIP_TYPE=roundtrip", file=sys.stderr)
        sys.exit(1)

    # Validate dates
    for name, val in [("OUTBOUND_FROM", required["OUTBOUND_FROM"]),
                      ("OUTBOUND_TO", required["OUTBOUND_TO"])]:
        try:
            datetime.strptime(val, "%Y-%m-%d")
        except ValueError:
            print(f"Error: {name} must be YYYY-MM-DD format, got '{val}'", file=sys.stderr)
            sys.exit(1)

    # Parse destinations
    dest = os.getenv("DESTINATION", "europe")
    if dest.lower() == "europe":
        destinations = EUROPE_AIRPORTS
    else:
        destinations = [code.strip().upper() for code in dest.split(",")]
        for code in destinations:
            if len(code) != 3:
                print(f"Error: invalid airport code '{code}' in DESTINATION", file=sys.stderr)
                sys.exit(1)

    providers_raw = os.getenv("PROVIDERS", "google,skyscanner")
    providers = [p.strip().lower() for p in providers_raw.split(",")]
    valid_providers = {"google", "skyscanner"}
    for p in providers:
        if p not in valid_providers:
            print(f"Error: unknown provider '{p}', must be one of: {', '.join(sorted(valid_providers))}", file=sys.stderr)
            sys.exit(1)

    return Config(
        smtp_email=required["SMTP_EMAIL"],
        smtp_password=required["SMTP_PASSWORD"],
        email_to=required["EMAIL_TO"],
        origin=os.getenv("ORIGIN", "TLV"),
        destinations=destinations,
        outbound_from=required["OUTBOUND_FROM"],
        outbound_to=required["OUTBOUND_TO"],
        return_from=return_from,
        return_to=return_to,
        trip_type=trip_type,
        stops=stops,
        providers=providers,
        headless=os.getenv("HEADLESS", "true").lower() == "true",
    )
