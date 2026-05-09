import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def mock_smtp_env_vars():
    """Set dummy SMTP env vars to prevent config.load_config() from sys.exit."""
    os.environ.setdefault("SMTP_EMAIL", "test@example.com")
    os.environ.setdefault("SMTP_PASSWORD", "dummy_password")
    os.environ.setdefault("EMAIL_TO", "recipient@example.com")
    os.environ.setdefault("OUTBOUND_FROM", "2026-06-01")
    os.environ.setdefault("OUTBOUND_TO", "2026-06-07")
    yield
