# syntax=docker/dockerfile:1
# CGO is off; do not install gcc and do not pass `go build -a` (rebuilds stdlib
# every time and is the usual "no space left on device" cause on small EC2 disks).

FROM golang:1.25-alpine AS builder

WORKDIR /app

ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOFLAGS=-buildvcs=false

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -ldflags="-s -w" -o server ./cmd/server

FROM alpine:3.20

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata \
    && adduser -D -g '' appuser

COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./server"]
