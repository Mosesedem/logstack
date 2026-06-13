# CLAUDE.md — Logstack

Guidance for working in this repository. Read this first.

## What this is
**Logstack** — a log-management platform: ingest logs via SDKs → store/stream → view in a
dashboard with alerts & billing. Git remote: `github.com/Mosesedem/logstack`.

> **Naming rule:** the canonical product/package name is **`logstack`** (git remote, npm
> `logstack-js`, PyPI `logstack`, Go module `.../logstack-go-sdk`, API `api.logstack.tech`,
> UI title). Directories are named `logship-*` — that is a half-applied rename we are **not**
> completing. Do **not** do a sweeping rename. Keep `logstack` in code/packages/docs; if a
> `logstack`/`logship` mismatch actually breaks a build/import/endpoint, fix that one spot
> toward `logstack` and flag it. Folder names (`logship-*`) can stay.

## Layout (monorepo: pnpm + turbo)
- `apps/web` — Next.js 15 dashboard + landing + docs (fumadocs). `@logstack/web`.
- `apps/mobile` — Flutter app.
- `packages/logship-go` — **Go backend** (Gin, GORM/Postgres, Redis, WebSocket). Module
  `github.com/mosesedem/logstack`. Entry `cmd/server/main.go`.
- `packages/logship-js` — JS/TS SDK, npm name `logstack-js`. Source `src/index.ts` → `dist/`.
- `packages/logship-go-sdk` — Go SDK (`logstack.go`).
- `packages/logship-python` — Python SDK (`logstack`).
- `packages/shared-types` — shared TS types.
- `docs/` — reference docs. `docs/progress.md` is the live progress tracker.

## Running locally
```bash
docker compose -f docker-compose.dev.yml up -d     # postgres:5432 + redis:6379
cp .env.example .env                                # then fill secrets
# Backend (from packages/logship-go):
go run ./cmd/server                                 # serves http://localhost:8080/v1
# Frontend:
pnpm --filter @logstack/web dev                     # or: pnpm dev (turbo, all)
```
- Web → backend base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:8080/v1`).
- Dashboard SDK logging key: `NEXT_PUBLIC_LOGSTACK_API_KEY`.

## Build / test / lint
- All: `pnpm build` · `pnpm lint` · `pnpm test` (turbo).
- Web: `pnpm --filter @logstack/web build` · `... type-check` · `... lint`.
- JS SDK: `pnpm --filter logstack-js build` (tsup → `dist/`) · `... test` (vitest).
- Go: from `packages/logship-go`: `go build ./...` · `go vet ./...` · `go test ./...`.

## Code style
Follow the **`go-and-typescript` skill** (`.claude/skills/go-and-typescript/SKILL.md`) for both
languages. Headline rules: structured `slog` (never `fmt.Print*`) in Go; no `any` and no silent
`catch {}` / no-op fallbacks in TS; decouple "log to console" from "send over network"; thread
config instead of hardcoding endpoints.

## Known gotchas (verified)
- **Silent no-op logger:** `apps/web/src/lib/logger.ts` replaces the client with a no-op when
  `NEXT_PUBLIC_LOGSTACK_API_KEY` is unset → no console output at all locally. Logging must
  degrade to console-only, never to nothing.
- **Dev logs vanish:** SDK only sends in `production`/`staging`; backend `ingestor.go` *drops*
  (Redis-only, no persist) non-production logs → dev/staging logs never reach the dashboard.
- **Double `/v1`:** `apiClient` base URL already ends in `/v1`; some calls (e.g. audit page)
  prepend `/v1` again → `/v1/v1/...` 404. Use paths relative to `/v1`.
- **WebSocket endpoint:** the web hook streams from `/v1/mobile/stream` (mobile endpoint).
- **Route protection:** `apps/web/proxy.ts` currently only matches `/about` → real auth-gating
  is not enforced at the edge.
- **Landing theme:** `app/(home)/layout.tsx` uses `forcedTheme="light"` though the landing is
  meant to be forced **dark**; three theme systems overlap (next-themes, fumadocs RootProvider,
  dead `@radix-ui/themes` import in root layout).

## Conventions for changes
- Update `docs/progress.md` as work lands. Don't trust its historical entries — verify against code.
- Commit on a branch; never commit/push unless asked. End commit messages with the Co-Authored-By
  trailer.
