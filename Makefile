.PHONY: setup dev build run cron test clean

# setup creates a venv and installs deps from public PyPI + public npm.
# If your environment has a custom PyPI mirror or npm registry configured
# at the user level, PIP_CONFIG_FILE=/dev/null and NPM_CONFIG_USERCONFIG=/dev/null
# will bypass them so this command is reproducible across machines.
setup:
	test -d .venv || python3 -m venv .venv
	PIP_CONFIG_FILE=/dev/null .venv/bin/pip install --index-url https://pypi.org/simple/ -r requirements.txt
	cd web && NPM_CONFIG_USERCONFIG=/dev/null npm install
	.venv/bin/python -m playwright install chromium

dev:
	.venv/bin/honcho start

build:
	cd web && npm run build

run:
	cd web && npm run build
	(sleep 1 && open http://localhost:7777) &
	.venv/bin/uvicorn api.main:app --port 7777

cron:
	.venv/bin/python main.py

test:
	.venv/bin/pytest
	cd web && npm test -- --run

clean:
	rm -rf .venv web/node_modules web/dist
