"""Airport search endpoint for UI typeahead."""

from fastapi import APIRouter, Query

import airports

router = APIRouter(prefix="/api/airports", tags=["airports"])


@router.get("/search")
def search_airports_endpoint(
    q: str = Query("", description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Max results (capped at 50)"),
) -> list[dict]:
    """Search airports by IATA code, city, or country."""
    query = q.strip()
    if not query:
        return []
    return airports.search_airports(query, min(limit, 50))
