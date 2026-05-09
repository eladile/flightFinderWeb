"""Search streaming endpoint with SSE and cancellation."""

import asyncio
import base64
import json
import logging
from typing import AsyncGenerator
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from sse_starlette.sse import EventSourceResponse

from api.schemas import SearchRequest, SSEEvent
import search_service

router = APIRouter(prefix="/api/search", tags=["search"])
log = logging.getLogger(__name__)

# Module-level dict mapping search_id -> cancel event
_ACTIVE_SEARCHES: dict[str, asyncio.Event] = {}


@router.get("")
async def stream_search(
    q: str = Query(..., description="Base64-encoded SearchRequest JSON"),
) -> EventSourceResponse:
    """Stream search results as SSE events.

    Events: search_id, plan, job_started, flight, job_completed, job_failed, done.
    """
    try:
        decoded = base64.b64decode(q).decode("utf-8")
        req = SearchRequest.model_validate_json(decoded)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid query parameter: {e}")

    search_id = uuid4().hex[:12]
    cancel_event = asyncio.Event()
    _ACTIVE_SEARCHES[search_id] = cancel_event

    async def event_generator() -> AsyncGenerator[dict, None]:
        try:
            # Send search_id first so client can cancel
            yield {
                "event": "search_id",
                "data": json.dumps({"searchId": search_id}),
            }

            # Run the blocking generator in a thread
            async for event_dict in _run_streaming_async(req, cancel_event):
                yield event_dict

        finally:
            _ACTIVE_SEARCHES.pop(search_id, None)

    return EventSourceResponse(event_generator())


@router.delete("/{search_id}")
async def cancel_search(search_id: str) -> dict:
    """Cancel an active search by search_id."""
    cancel_event = _ACTIVE_SEARCHES.get(search_id)
    if cancel_event:
        cancel_event.set()
        return {"cancelled": True}
    return {"cancelled": False}


async def _run_streaming_async(
    req: SearchRequest,
    cancel_event: asyncio.Event,
) -> AsyncGenerator[dict, None]:
    """Bridge the blocking search_service.run_streaming to async SSE events."""
    queue: asyncio.Queue[dict | None] = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def _producer() -> None:
        """Run in a background thread and push events to the queue."""
        try:
            for sse_event in search_service.run_streaming(req):
                # Check cancel flag between events
                if cancel_event.is_set():
                    break
                event_type = sse_event.type
                event_json = sse_event.model_dump_json(by_alias=True)
                asyncio.run_coroutine_threadsafe(
                    queue.put({"event": event_type, "data": event_json}),
                    loop,
                )
        except Exception as e:
            log.exception("Error in search streaming")
            # Send error event
            error_json = json.dumps({"error": str(e)})
            asyncio.run_coroutine_threadsafe(
                queue.put({"event": "error", "data": error_json}),
                loop,
            )
        finally:
            # Signal completion
            asyncio.run_coroutine_threadsafe(
                queue.put(None),
                loop,
            )

    # Start producer thread (don't await it, just schedule it)
    loop.run_in_executor(None, _producer)

    # Consume events from queue
    while True:
        event_dict = await queue.get()
        if event_dict is None:
            break
        yield event_dict
