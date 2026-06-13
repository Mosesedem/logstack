.PHONY: build run test clean migrate

# Build the application
build:
	go build -o bin/server cmd/server/main.go

# Run the application
run:
	go run cmd/server/main.go

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f coverage.out coverage.html

# Run database migrations
migrate:
	go run cmd/migrate/main.go

# Run with hot reload (requires air)
dev:
	air

# Generate mocks for testing
mocks:
	mockgen -source=internal/services/ingestor.go -destination=tests/mocks/ingestor_mock.go

# Lint the code
lint:
	golangci-lint run

# Format the code
fmt:
	go fmt ./...

# Docker build
docker-build:
	docker build -t logstack-go:latest .

# Docker run
docker-run:
	docker run -p 8080:8080 --env-file .env logstack-go:latest
