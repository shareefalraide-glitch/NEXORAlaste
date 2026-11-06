.PHONY: api-test api-vet ml-test frontend-check contracts-check parser-test

api-test:
	@test -n "$$NEXORA_TEST_DATABASE_URL" || (echo 'Set NEXORA_TEST_DATABASE_URL to a disposable test database first.'; exit 1)
	cd services/api && go test -race ./...

api-vet:
	cd services/api && go vet ./...

ml-test:
	cd services/ml && python -m pytest -q

frontend-check:
	cd frontend && npm ci && npm run test:structure && npm run test:unit && npm run lint && npm run format:check && npm run build

contracts-check:
	python scripts/check_contracts.py

parser-test:
	python -m unittest tools.test_import_sensor_logs -v
