#!/usr/bin/env bash
#
# Wrapper script for running flightFinderWeb via cron.
# Sources .env and activates the Python virtual environment.
#
# Usage: ./cron/run.sh
#

set -euo pipefail

# ---- Configuration (update these paths) ----
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ENV_FILE="${PROJECT_DIR}/.env"
VENV_DIR="${PROJECT_DIR}/.venv"
LOG_FILE="/var/log/flightfinder.log"
# ---------------------------------------------

echo "=== flightFinderWeb run at $(date -u '+%Y-%m-%d %H:%M:%S UTC') ===" >> "$LOG_FILE"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: env file not found at $ENV_FILE" >> "$LOG_FILE"
    exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
    echo "ERROR: virtual environment not found at $VENV_DIR" >> "$LOG_FILE"
    exit 1
fi

# Activate venv and source env
source "$VENV_DIR/bin/activate"
set -a
source "$ENV_FILE"
set +a

# Run the scraper
python "$PROJECT_DIR/main.py" >> "$LOG_FILE" 2>&1

echo "=== run complete ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
