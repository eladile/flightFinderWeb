.PHONY: setup dev build run cron test clean

# setup requires ARTIFACTORY_USERNAME and ARTIFACTORY_PASSWORD in your env
# (Tenable Artifactory credentials, used to install python deps).
setup:
	@test -n "$$ARTIFACTORY_USERNAME" || (echo "ARTIFACTORY_USERNAME not set" && exit 1)
	@test -n "$$ARTIFACTORY_PASSWORD" || (echo "ARTIFACTORY_PASSWORD not set" && exit 1)
	test -d .venv || python3 -m venv .venv
	PIP_CONFIG_FILE=/dev/null .venv/bin/pip install --index-url "https://$${ARTIFACTORY_USERNAME}:$${ARTIFACTORY_PASSWORD}@artifactory.eng.tenable.com/artifactory/api/pypi/tenable_pypigroup/simple" -r requirements.txt
	cd web && npm install
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
