# flightFinderWeb

A Python tool that scrapes Google Flights using Playwright to find direct flights from Israel (TLV) to European destinations, and sends email alerts via Gmail SMTP.

No API keys required. Runs as a cron job (e.g., every hour).

## Prerequisites

- **Python 3.10+** installed
- **Gmail account** with 2-Step Verification enabled (for App Password)
- **Internet access** (the scraper opens a browser to Google Flights)

## Setup

### 1. Gmail App Password

You need a Gmail **App Password** (not your regular password) for SMTP:

1. Go to [myaccount.google.com](https://myaccount.google.com/)
2. Navigate to **Security** > **2-Step Verification** (enable it if not already)
3. Scroll down to **App Passwords**
4. Click **Generate** (select "Mail" and your device)
5. Copy the 16-character password — this is your `SMTP_PASSWORD`

**Note:** App Passwords only work with accounts that have 2-Step Verification enabled.

### 2. Clone and Set Up

```bash
git clone <this-repo>
cd flightFinderWeb

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Chromium browser for Playwright
playwright install chromium

# On Linux servers, also install system dependencies:
# playwright install --with-deps chromium
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your Gmail credentials and search parameters
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMTP_EMAIL` | Yes | — | Gmail address to send from |
| `SMTP_PASSWORD` | Yes | — | Gmail App Password (16 chars) |
| `EMAIL_TO` | Yes | — | Recipient email address |
| `ORIGIN` | No | `TLV` | Origin airport IATA code |
| `DESTINATION` | No | `europe` | `europe` for 20 European airports, or comma-separated IATA codes |
| `OUTBOUND_FROM` | Yes | — | Start of outbound date range (`YYYY-MM-DD`) |
| `OUTBOUND_TO` | Yes | — | End of outbound date range (`YYYY-MM-DD`) |
| `RETURN_FROM` | Roundtrip | — | Start of return date range (`YYYY-MM-DD`) |
| `RETURN_TO` | Roundtrip | — | End of return date range (`YYYY-MM-DD`) |
| `TRIP_TYPE` | No | `oneway` | `oneway` or `roundtrip` |
| `HEADLESS` | No | `true` | Set to `false` to watch the browser during development |

## Usage

### Manual Run

```bash
source .venv/bin/activate
source .env

# Run with browser visible (for debugging)
HEADLESS=false python main.py

# Run headless (for production)
python main.py
```

### Quick Test

```bash
# Search only one destination to verify it works
DESTINATION=BCN HEADLESS=false python main.py
```

### Cron Job (Run Every Hour)

See the [Cron Job Setup](#cron-job-setup) section below.

## Built-in Europe Airport List

When `DESTINATION=europe` (the default), the scraper searches these 20 airports:

| Code | City | Code | City |
|------|------|------|------|
| AMS | Amsterdam | LHR | London |
| ATH | Athens | LIS | Lisbon |
| BCN | Barcelona | MAD | Madrid |
| BER | Berlin | MIL | Milan |
| BRU | Brussels | MUC | Munich |
| BUD | Budapest | OSL | Oslo |
| CDG | Paris | PRG | Prague |
| CPH | Copenhagen | SOF | Sofia |
| FCO | Rome | VIE | Vienna |
| — | — | WAW | Warsaw |
| — | — | ZRH | Zurich |

## How It Works

1. Launches a Chromium browser via Playwright (headless by default)
2. For each destination airport:
   - Navigates to Google Flights
   - Enters origin, destination, and dates
   - Applies the "Nonstop only" filter
   - Scrapes flight results (airline, times, duration, price)
3. If any flights are found, sends an HTML email via Gmail SMTP
4. Exits

Each destination takes ~5-10 seconds. A full run with 20 destinations takes ~2-3 minutes.

## Cron Job Setup

### Using the Provided Scripts

1. **Set up the `.env` file:**
   ```bash
   cp .env.example .env
   vim .env
   ```

2. **Make the wrapper script executable:**
   ```bash
   chmod +x cron/run.sh
   ```

3. **Edit `cron/run.sh`** and verify the paths:
   - `PROJECT_DIR` — auto-detected from script location
   - `VENV_DIR` — path to your `.venv` directory
   - `LOG_FILE` — where to write logs

4. **Install the cron job:**
   ```bash
   (crontab -l 2>/dev/null; cat cron/flightfinder.cron) | crontab -
   crontab -l  # verify
   ```

5. **Test:**
   ```bash
   ./cron/run.sh
   tail -f /var/log/flightfinder.log
   ```

### Removing the Cron Job

```bash
crontab -e  # remove the flightfinder line
```

## Troubleshooting

### "required env vars: SMTP_EMAIL, ..."
Make sure your `.env` file exists and is sourced. Run `source .env` before `python main.py`.

### Gmail authentication failed
- Verify your App Password is correct (16 characters, no spaces)
- Make sure 2-Step Verification is enabled on your Google account
- App Passwords don't work with Google Workspace accounts that have App Passwords disabled by admin

### No flights found for any destination
- Try with `HEADLESS=false` to watch the browser and see what's happening
- Check the `screenshots/` directory for error screenshots
- Google Flights may show a consent dialog in a new locale — the scraper handles this but check screenshots
- Verify your dates are in the future

### Browser fails to launch
```bash
# Reinstall Chromium
playwright install chromium

# On Linux, install system dependencies too:
playwright install --with-deps chromium
```

### "Nonstop only" filter not working
Google Flights may change their DOM structure. Check error screenshots and update selectors in `scraper.py` if needed. The scraper uses aria-labels which are more stable than CSS classes.

### Cron job not running
```bash
# macOS
log show --predicate 'process == "cron"' --last 1h

# Linux
grep CRON /var/log/syslog

# Verify script is executable
chmod +x cron/run.sh

# Test manually
./cron/run.sh
```

### Scraper is too slow
Each destination takes ~5-10 seconds. For 20 destinations, expect ~2-3 minutes. This is acceptable for hourly cron. To speed up:
- Reduce the number of destinations: `DESTINATION=BCN,ATH,FCO`
- Parallelization can be added later if needed

## Project Structure

```
flightFinderWeb/
  main.py           — entry point and orchestration
  config.py         — environment variable loading and validation
  scraper.py        — Playwright Google Flights scraper
  emailer.py        — Gmail SMTP email sender
  requirements.txt  — Python dependencies
  cron/
    flightfinder.cron — crontab entry
    run.sh            — wrapper script for cron
  screenshots/        — error screenshots (auto-created)
  .env.example        — template environment file
```
