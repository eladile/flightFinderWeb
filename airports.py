"""Bundled offline IATA airport dataset with a ranked typeahead scorer.

Loads `airportsdata` (MIT-licensed, ~28k rows) once at import time, filters
to commercial airports, and exposes two public helpers:

    search_airports(query, limit) — ranked prefix/substring match for UI typeahead
    get_by_iata(code)             — O(1) lookup by IATA code

The scorer's ranking levels are strictly ordered (per the plan):
    1. Exact IATA match
    2. IATA prefix
    3. City prefix
    4. City word-start (any space-delimited word starts with query)
    5. Name substring
    6. Country prefix
Within a rank, results are sorted alphabetically by city.
"""

from __future__ import annotations

import airportsdata

# ISO-3166 alpha-2 → continent grouping. Minimal map covering the countries we
# care about for the UI region filter; everything else falls back to "Other".
# Presets in the frontend only need the common travel regions.
COUNTRY_TO_REGION: dict[str, str] = {
    # Europe
    "AD": "Europe", "AL": "Europe", "AT": "Europe", "BA": "Europe", "BE": "Europe",
    "BG": "Europe", "BY": "Europe", "CH": "Europe", "CY": "Europe", "CZ": "Europe",
    "DE": "Europe", "DK": "Europe", "EE": "Europe", "ES": "Europe", "FI": "Europe",
    "FO": "Europe", "FR": "Europe", "GB": "Europe", "GG": "Europe", "GI": "Europe",
    "GR": "Europe", "HR": "Europe", "HU": "Europe", "IE": "Europe", "IM": "Europe",
    "IS": "Europe", "IT": "Europe", "JE": "Europe", "LI": "Europe", "LT": "Europe",
    "LU": "Europe", "LV": "Europe", "MC": "Europe", "MD": "Europe", "ME": "Europe",
    "MK": "Europe", "MT": "Europe", "NL": "Europe", "NO": "Europe", "PL": "Europe",
    "PT": "Europe", "RO": "Europe", "RS": "Europe", "RU": "Europe", "SE": "Europe",
    "SI": "Europe", "SK": "Europe", "SM": "Europe", "UA": "Europe", "VA": "Europe",
    "XK": "Europe",
    # North America
    "BM": "North America", "CA": "North America", "GL": "North America",
    "MX": "North America", "PM": "North America", "US": "North America",
    # Central America & Caribbean (treated as North America for simplicity)
    "AG": "North America", "AI": "North America", "AW": "North America",
    "BB": "North America", "BS": "North America", "BZ": "North America",
    "CR": "North America", "CU": "North America", "DM": "North America",
    "DO": "North America", "GD": "North America", "GT": "North America",
    "HN": "North America", "HT": "North America", "JM": "North America",
    "KN": "North America", "KY": "North America", "LC": "North America",
    "MS": "North America", "NI": "North America", "PA": "North America",
    "PR": "North America", "SV": "North America", "TC": "North America",
    "TT": "North America", "VC": "North America", "VG": "North America",
    "VI": "North America",
    # South America
    "AR": "South America", "BO": "South America", "BR": "South America",
    "CL": "South America", "CO": "South America", "EC": "South America",
    "FK": "South America", "GF": "South America", "GY": "South America",
    "PE": "South America", "PY": "South America", "SR": "South America",
    "UY": "South America", "VE": "South America",
    # Asia
    "AE": "Asia", "AF": "Asia", "AM": "Asia", "AZ": "Asia", "BD": "Asia",
    "BH": "Asia", "BN": "Asia", "BT": "Asia", "CN": "Asia", "GE": "Asia",
    "HK": "Asia", "ID": "Asia", "IL": "Asia", "IN": "Asia", "IQ": "Asia",
    "IR": "Asia", "JO": "Asia", "JP": "Asia", "KG": "Asia", "KH": "Asia",
    "KP": "Asia", "KR": "Asia", "KW": "Asia", "KZ": "Asia", "LA": "Asia",
    "LB": "Asia", "LK": "Asia", "MM": "Asia", "MN": "Asia", "MO": "Asia",
    "MV": "Asia", "MY": "Asia", "NP": "Asia", "OM": "Asia", "PH": "Asia",
    "PK": "Asia", "PS": "Asia", "QA": "Asia", "SA": "Asia", "SG": "Asia",
    "SY": "Asia", "TH": "Asia", "TJ": "Asia", "TL": "Asia", "TM": "Asia",
    "TR": "Asia", "TW": "Asia", "UZ": "Asia", "VN": "Asia", "YE": "Asia",
    # Africa
    "AO": "Africa", "BF": "Africa", "BI": "Africa", "BJ": "Africa", "BW": "Africa",
    "CD": "Africa", "CF": "Africa", "CG": "Africa", "CI": "Africa", "CM": "Africa",
    "CV": "Africa", "DJ": "Africa", "DZ": "Africa", "EG": "Africa", "EH": "Africa",
    "ER": "Africa", "ET": "Africa", "GA": "Africa", "GH": "Africa", "GM": "Africa",
    "GN": "Africa", "GQ": "Africa", "GW": "Africa", "KE": "Africa", "KM": "Africa",
    "LR": "Africa", "LS": "Africa", "LY": "Africa", "MA": "Africa", "MG": "Africa",
    "ML": "Africa", "MR": "Africa", "MU": "Africa", "MW": "Africa", "MZ": "Africa",
    "NA": "Africa", "NE": "Africa", "NG": "Africa", "RE": "Africa", "RW": "Africa",
    "SC": "Africa", "SD": "Africa", "SL": "Africa", "SN": "Africa", "SO": "Africa",
    "SS": "Africa", "ST": "Africa", "SZ": "Africa", "TD": "Africa", "TG": "Africa",
    "TN": "Africa", "TZ": "Africa", "UG": "Africa", "YT": "Africa", "ZA": "Africa",
    "ZM": "Africa", "ZW": "Africa",
    # Oceania
    "AS": "Oceania", "AU": "Oceania", "CK": "Oceania", "FJ": "Oceania",
    "FM": "Oceania", "GU": "Oceania", "KI": "Oceania", "MH": "Oceania",
    "MP": "Oceania", "NC": "Oceania", "NF": "Oceania", "NR": "Oceania",
    "NU": "Oceania", "NZ": "Oceania", "PF": "Oceania", "PG": "Oceania",
    "PN": "Oceania", "PW": "Oceania", "SB": "Oceania", "TK": "Oceania",
    "TO": "Oceania", "TV": "Oceania", "VU": "Oceania", "WF": "Oceania",
    "WS": "Oceania",
    # Antarctica
    "AQ": "Antarctica", "BV": "Antarctica", "GS": "Antarctica", "HM": "Antarctica",
    "TF": "Antarctica",
}

# ISO-3166 alpha-2 → human-readable country name. Small map; falls back to the
# raw code for unmapped countries. Covers the common travel destinations.
COUNTRY_CODE_TO_NAME: dict[str, str] = {
    "AE": "United Arab Emirates", "AR": "Argentina", "AT": "Austria", "AU": "Australia",
    "BE": "Belgium", "BR": "Brazil", "CA": "Canada", "CH": "Switzerland",
    "CL": "Chile", "CN": "China", "CO": "Colombia", "CZ": "Czechia",
    "DE": "Germany", "DK": "Denmark", "EG": "Egypt", "ES": "Spain",
    "FI": "Finland", "FR": "France", "GB": "United Kingdom", "GR": "Greece",
    "HK": "Hong Kong", "HU": "Hungary", "ID": "Indonesia", "IE": "Ireland",
    "IL": "Israel", "IN": "India", "IS": "Iceland", "IT": "Italy",
    "JP": "Japan", "KR": "South Korea", "MA": "Morocco", "MX": "Mexico",
    "MY": "Malaysia", "NL": "Netherlands", "NO": "Norway", "NZ": "New Zealand",
    "PE": "Peru", "PH": "Philippines", "PL": "Poland", "PT": "Portugal",
    "QA": "Qatar", "RO": "Romania", "RU": "Russia", "SA": "Saudi Arabia",
    "SE": "Sweden", "SG": "Singapore", "TH": "Thailand", "TR": "Turkey",
    "TW": "Taiwan", "UA": "Ukraine", "US": "United States", "VN": "Vietnam",
    "ZA": "South Africa",
}


def _normalize(row: dict) -> dict:
    country = row.get("country", "") or ""
    return {
        "iata": row["iata"],
        "icao": row.get("icao", "") or "",
        "name": row.get("name", "") or "",
        "city": row.get("city", "") or "",
        "country": country,
        "country_name": COUNTRY_CODE_TO_NAME.get(country, country),
        "region": COUNTRY_TO_REGION.get(country, "Other"),
        "tz": row.get("tz", "") or "",
    }


def _load() -> list[dict]:
    """Load and filter airportsdata.

    airportsdata rows have no `type` field, so we filter by the heuristic from
    the plan: must have both IATA and ICAO codes, plus a non-empty city. This
    drops helipads, private strips, and military-only codes, leaving ~7k
    commercial airports.
    """
    raw = airportsdata.load("IATA")
    rows: list[dict] = []
    for row in raw.values():
        iata = row.get("iata")
        icao = row.get("icao")
        city = (row.get("city") or "").strip()
        if not iata or not icao or not city:
            continue
        rows.append(_normalize(row))
    return rows


_AIRPORTS: list[dict] = _load()
_BY_IATA: dict[str, dict] = {a["iata"]: a for a in _AIRPORTS}

# Precomputed per-row search tuple:
#   (iata, city, city_lower, city_words, name_lower, country_lower,
#    country_name_lower, row)
# Parallel list so the hot loop in search_airports avoids per-row dict access
# and repeated .lower()/.split() calls.
_SEARCH_INDEX: list[tuple] = [
    (
        a["iata"],
        a["city"],
        a["city"].lower(),
        tuple(a["city"].lower().split()),
        a["name"].lower(),
        a["country"].lower(),
        a["country_name"].lower(),
        a,
    )
    for a in _AIRPORTS
]


def all_airports() -> list[dict]:
    """Return the full filtered, normalized airport list (shared reference)."""
    return _AIRPORTS


def get_by_iata(code: str) -> dict | None:
    """Look up an airport by its IATA code (case-insensitive)."""
    if not code:
        return None
    return _BY_IATA.get(code.strip().upper())


def search_airports(query: str, limit: int = 10) -> list[dict]:
    """Ranked prefix/substring search over the airport dataset.

    Rank order (lower rank = higher priority):
        0. Exact IATA match
        1. IATA prefix
        2. City prefix
        3. City word-start (any space-delimited word starts with query)
        4. Name substring
        5. Country (code or name) prefix
    Within the same rank, rows are sorted alphabetically by city.
    """
    q = query.strip().lower()
    if not q:
        return []

    q_upper = q.upper()

    # Fast path for exact IATA match: single dict lookup, no scan.
    exact = _BY_IATA.get(q_upper)

    scored: list[tuple[int, str, str, dict]] = []
    if exact is not None:
        scored.append((0, exact["city"], exact["iata"], exact))

    for iata, city, city_lower, city_words, name_lower, country_lower, country_name_lower, a in _SEARCH_INDEX:
        if iata == q_upper:
            continue  # already added as rank 0
        if iata.startswith(q_upper):
            rank = 1
        elif city_lower.startswith(q):
            rank = 2
        elif any(w.startswith(q) for w in city_words):
            rank = 3
        elif q in name_lower:
            rank = 4
        elif country_lower.startswith(q) or country_name_lower.startswith(q):
            rank = 5
        else:
            continue
        scored.append((rank, city, iata, a))

    scored.sort(key=lambda t: (t[0], t[1], t[2]))
    return [a for _, _, _, a in scored[:limit]]
