"""Configuration endpoint for UI defaults."""

import logging

from fastapi import APIRouter, HTTPException

from config import load_config

router = APIRouter(prefix="/api/config", tags=["config"])
log = logging.getLogger(__name__)


@router.get("/email_to")
def get_email_to() -> dict:
    """Return configured default email recipient."""
    try:
        cfg = load_config()
    except SystemExit:
        raise HTTPException(status_code=500, detail="Configuration missing or invalid")
    return {"emailTo": cfg.email_to}
