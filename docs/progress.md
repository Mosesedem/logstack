# Logstack — Stabilization & Publish Progress

> Live tracker for the current effort. Updated as work lands.
> Started: 2026-06-13 · Legend: ✅ done · 🔄 in progress · ⏳ pending · ⏸ blocked (needs input)
>
> Note: the previous tracker (claiming "28/30, 93%", dated May 6 2026) was inaccurate vs. the
> actual code state and has been replaced. Trust code over historical claims.

## Phase 0 — Deliverables & tracker

| Item          | Status | Notes                                               |
| ------------- | ------ | --------------------------------------------------- |
| Go+TS skill   | ✅     | `.claude/skills/go-and-typescript/SKILL.md`         |
| CLAUDE.md     | ✅     | repo root — layout, run steps, naming rule, gotchas |
| Fresh tracker | ✅     | this file                                           |

## Phase 1 — Local logging works end-to-end

| Item                                                                                  | Status | Notes                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logger.ts` no longer no-ops without key                                              | ✅     | console-only (`disabled`) fallback + single warning                                                                                                                           |
| SDK: decouple console vs send; `silent`/`disabled` flags; honor `consoleInProduction` | ✅     | sends in all envs when apiKey+endpoint set                                                                                                                                    |
| SDK: fixed wrong ingest path `/api/v1/logs` → `/v1/logs`                              | ✅     | matched backend router; was a 404                                                                                                                                             |
| SDK: offline-queue size cap                                                           | ✅     | `maxOfflineQueueSize`, default 1000                                                                                                                                           |
| Backend ingestor persists non-production logs                                         | ✅     | all envs queryable; usage metered prod-only                                                                                                                                   |
| Rebuild SDK `dist/`                                                                   | ✅     | tsup build + vitest pass                                                                                                                                                      |
| Verified                                                                              | ✅     | SDK build+test, Go build/vet/test, web type-check, Node console smoke test all pass. Full stack e2e (dev project→log→dashboard) recommended as manual check once stack is up. |

## Phase 2 — Dashboard → project journey

| Item                                                                | Status | Notes                                                                                                                                                              |
| ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Post-login redirect to dashboard                                    | ✅     | already redirects to `/logs` (was a stale poor.md item)                                                                                                            |
| Audit double-`/v1`                                                  | ✅     | already correct in code (stale poor.md item)                                                                                                                       |
| WebSocket auth works for browsers                                   | ✅     | new `WSAuth` reads token from `Sec-WebSocket-Protocol`/`?token=`; `JWTAuth` header-only auth could never authenticate a browser socket                             |
| WebSocket endpoint decoupled from `/mobile`                         | ✅     | new `/v1/stream`; hook updated; `/v1/mobile/stream` kept for native                                                                                                |
| Projects query error surfaced                                       | ✅     | `useProject` now exposes `error` instead of silent `[]`                                                                                                            |
| Dedicated logs viewer page (list + filters + realtime, dedupe, cap) | ✅     | `/logs` now the viewer (paginated query + live WS, dedupe by id, cap 500); stats moved to `/overview` + nav item; post-login + marketing "Dashboard" → `/overview` |
| API key view/rotate after creation                                  | ✅     | rotate now shows key in the secure modal (was a dismissible toast)                                                                                                 |

## Phase 3 — SDK correctness + publish

| Item                                        | Status | Notes                                                                                                                                                                                            |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SDK behavior/endpoints sweep (JS/Go/Python) | ✅     | Fixed ingest path in all three (`/v1/logs/batch`→`/v1/logs`, JS `/api/v1/logs`→`/v1/logs`); Go now accepts 201, no lock held over network I/O, wrapped errors; Python uses `logging` not `print` |
| LICENSE files (root + per package)          | ✅     | MIT, Mosesedem, at root + js/go-sdk/python                                                                                                                                                       |
| JS package.json metadata                    | ✅     | repository/homepage/bugs/author/publishConfig/exports; `npm pack` ships LICENSE+README+dist                                                                                                      |
| Python pyproject.toml + version 1.0.0       | ✅     | added pyproject.toml; bumped setup.py + `__version__` to 1.0.0; fixed repo URL casing                                                                                                            |
| Go module path resolution                   | ✅     | `github.com/Mosesedem/logstack/packages/logstack-go-sdk` (monorepo subdir); READMEs + folder rename completed                                                                                    |
| Publish (npm/PyPI/Go)                       | ⏸      | **Needs your credentials** — see note below                                                                                                                                                      |

## Phase 4 — Landing forced-dark + theme reconcile

| Item                              | Status | Notes                                                                                                                                       |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `(home)/layout.tsx` forced dark   | ✅     | deterministic `dark` wrapper div (no next-themes race/flash)                                                                                |
| `(auth)/layout.tsx` forced dark   | ✅     | consistent dark brand; was forced light                                                                                                     |
| Remove dead Radix theme imports   | ✅     | dropped `@radix-ui/themes` Theme/ThemePanel + unused ThemeProvider from root layout                                                         |
| Reconcile theme systems, no flash | ✅     | landing/auth/dashboard all use the CSS `dark` class pattern; fumadocs RootProvider still owns docs theming. Visual confirm pending runtime. |

## Phase 5 — Docs cleanup

| Item                  | Status | Notes                                                                                                                                                                                                                                                             |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove stale docs     | ✅     | deleted complete_plan.md, poor.md, product_update.md, VIBECODERS.md (git-recoverable)                                                                                                                                                                             |
| Update reference docs | ✅     | README index rewritten (also dropped dead DESIGN_GUIDE link); API.md ingest response (`persisted`) + `/v1/stream` endpoint + levels; SDK.md new config flags/behavior + debug/fatal levels. BACKEND/DEPLOYMENT/FCM/CONTRIBUTING spot-checked — no stale behavior. |

## Change log

| Date       | Change                                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-13 | Phase 0: added go-and-typescript skill, root CLAUDE.md, replaced stale tracker                                                                                                                                                               |
| 2026-06-13 | Phase 1: fixed dashboard no-op logger; decoupled SDK console/send + silent/disabled/queue-cap; fixed SDK ingest path `/api/v1/logs`→`/v1/logs`; backend persists all-env logs; rebuilt SDK. Verified via builds/tests/type-check/Node smoke. |
| 2026-06-13 | Phase 2 (core): added `WSAuth` (browser WebSocket token via subprotocol/query); decoupled `/v1/stream` from `/mobile`; updated web hook; surfaced projects-query errors. Audit `/v1/v1` and post-login redirect were already correct.        |
| 2026-06-13 | Phase 4: landing + auth forced dark via `dark` wrapper; removed dead Radix theme imports.                                                                                                                                                    |
| 2026-06-13 | Phase 2 (logs viewer): `/logs` now real viewer (paginated + live WS, dedupe, cap); stats → `/overview` + nav; key rotate uses secure modal.                                                                                                  |
| 2026-06-13 | Phase 5: deleted 4 stale docs; refreshed README/API.md/SDK.md.                                                                                                                                                                               |
| 2026-06-13 | Phase 3: fixed ingest-path/status bugs in Go+Python SDKs; Go lock-over-IO fix; LICENSE×4; JS metadata; Python pyproject+v1.0.0; Go module path; self-contained READMEs. Publish pending credentials.                                         |
| 2026-06-15 | Added focused AWS EC2 Docker deploy doc for updating an already-running instance; linked it from docs index.                                                                                                                                 |
| 2026-06-15 | Backend config now loads `.env` on startup and reads env-driven values instead of hardcoded fallback literals; CORS no longer panics on empty origins.                                                                                       |

---

## Publishing — what's needed from you

All three SDKs are prepared and build clean. Release automation is now wired for the JS package and the AWS deploy workflow is no longer a stub; to actually publish/deploy, I still need your live credentials.

To actually publish (you chose publish-all):

- **npm (`logstack-js`)**: `npm login` (or an `NPM_TOKEN`). Then from `packages/logstack-js`:
  `npm publish` (package is public via `publishConfig`). Verify the name `logstack-js` is
  available/owned by you.
- **PyPI (`logstack`)**: a PyPI API token. Build with `python -m build` (needs `pip install build`)
  from `packages/logstack-python`, then `twine upload dist/*`. Verify the name `logstack` is
  available on PyPI.
- **Go**: no registry push — pkg.go.dev indexes from a Git tag. Since the module lives in a
  subdir, the tag must be path-scoped, e.g. `packages/logstack-go-sdk/v1.0.0`. Push that tag to
  `github.com/Mosesedem/logstack` and the module resolves for `go get`.

I paused here rather than guessing credentials. Tell me when you're authed (or provide tokens)
and which to publish, and I'll run them.

---

## Phase 6 — Naming alignment to Logstack (user-directed full rename)

| Item                                                                                                                                                  | Status | Notes                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Rename all `logship-*` package folders → `logstack-*`                                                                                                 | ✅     | packages/logstack-go, logstack-go-sdk, logstack-js, logstack-python                                        |
| Rename Python source package dir `logship/` → `logstack/`                                                                                             | ✅     | Now `from logstack import ...` will match installed package layout (was mismatched)                        |
| Rename Go SDK file `logship.go` → `logstack.go`                                                                                                       | ✅     | Cosmetic; package clause was already `logstack`                                                            |
| Update all references (CLAUDE.md, progress, READMEs, package metadata, go.mod module path, pyproject include, docker-compose context already matched) | ✅     | pnpm-lock, web node_modules cache, tsbuildinfo are generated — will be refreshed on `pnpm install` + clean |
| Root workspace dir on disk (local clone)                                                                                                              | ✅     | Renamed to `logstack` (checkout dir name aligned; git remote always was `logstack`)                        |
| Update "naming rule" guidance in CLAUDE.md                                                                                                            | ✅     | Removed "do not sweep rename" language; now fully aligned                                                  |

## Phase 7 — Current build & integration status (as of 2026-06-15)

| Component                     | Command / Check                                                                                                | Status                            | Notes                                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Go backend (logstack-go)      | `cd packages/logstack-go && go build ./... && go vet ./... && go test ./...`                                   | 🔄 Pending full run (post-rename) | Module path stable (`github.com/mosesedem/logstack`); imports internal/\* resolve from go.mod location; openapi.yaml + migrations present; workers, WS, billing, alerts, auth all wired in main.go |
| JS SDK (logstack-js)          | `cd packages/logstack-js && pnpm build && pnpm test`                                                           | 🔄 Pending                        | Already had dist/ from before; workspace dep in web is "logstack-js" (correct)                                                                                                                     |
| Python SDK (logstack)         | `cd packages/logstack-python && python -m build` (or pip install -e .)                                         | 🔄 Pending                        | pyproject now includes logstack/\* ; **init** exports LogStackClient etc; README examples use `logstack` import                                                                                    |
| Web dashboard (@logstack/web) | `cd apps/web && pnpm type-check && pnpm build`                                                                 | 🔄 Pending                        | Uses workspace:^ logstack-js; has / (home), (dashboard), (auth), admin, fumadocs content; api-client, logger, WS hook                                                                              |
| Mobile (Flutter)              | `cd apps/mobile && flutter analyze && flutter build apk --debug` (or ios)                                      | 🔄 Pending (needs Flutter SDK)    | Full providers (auth, projects, logs, alerts, billing); api_client.dart, services; models + router + screens for complete journey; firebase_options.example present                                |
| Monorepo                      | `pnpm install` (after dir rename) then `pnpm build` / `pnpm lint` / `pnpm test`                                | 🔄 Required                       | Root package.json + turbo + pnpm-workspace (globs \*) are name-agnostic; lockfile has stale links to old logship-js paths                                                                          |
| Docker build                  | `docker compose -f docker-compose.yml build`                                                                   | 🔄                                | docker-compose.yml already pointed at `./packages/logstack-go` (good); dev compose only infra                                                                                                      |
| End-to-end smoke              | docker dev up; start backend; pnpm --filter @logstack/web dev; send log via SDK or curl with key; see in /logs | ⏳ Manual                         | Per Phase 1 verified previously                                                                                                                                                                    |

**Summary of build situation:** Core pieces are complete and were building before rename. The rename was purely mechanical (dirs + strings). Stale lock/node_modules are the only expected breakage. Once `pnpm install` + clean + rebuilds pass, we are at the same (or better) readiness as the prior "Phase 1 verified" state.

## Phase 8 — Production launch preparation (target: release today 2026-06-15)

| Area                      | Items                                                                                                     | Status | Action / Blocker                                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Secrets & Config**      | JWT_SECRET (32+), NEXTAUTH_SECRET, DB/Redis strong pass, Paystack/FCM/Resend keys, ALLOWED_ORIGINS no `*` | ⏳     | User must generate + set in prod .env (see .env.example + production-checklist). Backend config now loads local `.env` first and no longer relies on hardcoded fallback values.                                                                   |
| **API / URL consistency** | No double /v1 or /api/v1                                                                                  | ⚠️     | .env.example has `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1` and WS `.../api/v1` — conflicts with backend /v1 and known-gotcha guidance (should be `/v1`). apiClient in web may be prepending. Fix before launch. Mobile api_client.dart ? |
| **Docker / Infra**        | prod compose, nginx, health/readiness                                                                     | ✅     | docker-compose.yml good for api+postgres+redis; has health in Dockerfile; nginx in infra/                                                                                                                                                         |
| **Docs for launch**       | DEPLOYMENT.md, production-checklist.mdx, API.md, SDK.md, quickstart                                       | ✅     | Mostly current; progress + CLAUDE updated. Root README reflects logstack everywhere.                                                                                                                                                              |
| **SDK publish**           | npm / pypi / go tag                                                                                       | ⏸      | Blocked on credentials (Phase 3). Folder paths now correct for tags (`packages/logstack-go-sdk/vX.Y.Z`)                                                                                                                                           |
| **Mobile release**        | Flutter build, store assets, FCM, TestFlight / Play                                                       | ⏳     | App code complete (auth, projects, realtime logs, alerts, billing UI); needs real device testing + firebase_options.dart filled + release signing. No obvious "logship" left.                                                                     |
| **Web dashboard**         | Build, auth flows, realtime WS, billing integration, admin                                                | ✅/🔄  | Appears feature-complete from prior phases; forced-dark landing fixed; logger no longer no-ops. Needs runtime test post pnpm install.                                                                                                             |
| **Backend prod**          | Rate limits, usage metering only on prod, retention worker, alert processor, no dev drops                 | ✅     | From prior fixes: ingestor persists all envs, usage prod-only. Workers in main.                                                                                                                                                                   |
| **Known gotchas closed**  | logger, double-v1, WS auth, theme, dev logs                                                               | ✅     | Per tracker Phases 1-4.                                                                                                                                                                                                                           |
| **.env / startup**        | .env copy, docker up, first signup, project create, key copy, SDK log, see in dashboard                   | ⏳     | Standard. Note: web .env.example (or turbo) needs correct NEXT*PUBLIC*\*\_URL without extra /api                                                                                                                                                  |
| **Release artifacts**     | CHANGELOG or tag, GitHub release, announce                                                                | ⏳     | Update progress as final. Commit with Co-Authored-By.                                                                                                                                                                                             |

**Launch blockers / immediate to-dos (do before EOD):**

1. (Done) Fix NEXT_PUBLIC_API_URL / WS_URL in .env.example + mobile api_client.dart (now /v1); nginx rewrite added for /api compat; openapi + content docs mdx aligned to official /v1 base.
2. (Done via verification) `pnpm install` after rename + clean (stale logship-js links removed; lock regenerated).
3. (Done) Verify Go builds cleanly from packages/logstack-go (full build/vet/test green).
4. (Partial) Web `type-check` green but `next build` red due to fumadocs 14 + Next 16.1 peer/subpath export breakage in next.config + source.config (see subagent report). Fix by aligning fumadocs versions or Next pin in apps/web/package.json + re-pnpm + build.
5. (Done in sub) JS SDK + Python SDK build/import verified green.
6. (Partial) Mobile: `flutter pub get` ok + Flutter 3.41 present, but `flutter analyze` fails with dozens of issues (missing _.freezed.dart / _.g.dart from build_runner, undefined model fields/getters, missing screens like logs_screen.dart + log_detail_screen.dart, theme.dart syntax, missing url_launcher, etc.). Run build_runner, fill missing files, fix model/provider contracts before release build.
7. Full e2e smoke + prod secrets + SDK publish credentials still needed.
8. Update this progress + commit on branch with Co-Authored-By when blockers cleared.

**Readiness verdict (post-verification + fixes 2026-06-15):**

- **Rename:** 100% complete and consistent across folders (`logstack-*`), Python package dir, Go SDK source file, all references (CLAUDE, progress, manifests, go.mod, pyproject, READMEs, docker contexts, nginx, docs examples). No "logship" remains in active non-generated source.
- **Core (Go APIs + SDKs):** Fully verified green (build/vet/test for backend, SDK builds + tests + Python import). Docker configs (compose + web + Go Dockerfiles) solid.
- **Web dashboard:** CDN support added (`NEXT_PUBLIC_CDN_URL` → `assetPrefix` + image patterns in next.config.mjs; strong immutable caching in nginx for `/_next/static/*`). `output: "standalone"` (Docker-friendly) preserved. Version adjusted to Next 15.3.1 + fumadocs 15 for reliable build compatibility with React 19 (previous 16.1.1 + 14.x/15.x mix was the source of the subpath export failure). Type-check was already clean.
- **Mobile:** Major progress. Theme corruption fixed. Two missing router-referenced screens created + wired (`logs_screen`, `log_detail_screen`). `url_launcher` dep added. `build_runner` now successfully generates the full `*.freezed.dart` + `*.g.dart` set. Analyze dropped from ~101 issues to ~26 (mostly small remaining nullability, API mapping in the new screens, M3 CardThemeData, and deprecations — core routing/providers/models now functional).
- **CDN:** Enabled and deployable (Next assetPrefix + nginx cache headers + documented CloudFront behaviors for static vs. dynamic/WS/API paths).
- **AWS EC2 Docker deploy:** Fully prepared. Updated root `docker-compose.yml` now includes the `web` service (full stack with one command). New `infra/aws/ec2-user-data.sh` (ready User Data script for EC2 launch: docker + compose + clone + .env + `up -d --build`). Enhanced `DEPLOYMENT.md` with dedicated "AWS EC2 + Docker Compose" + detailed "CDN with CloudFront" sections. nginx improved for static + web frontend.

**Enroute for production launch today?** Yes for the backend/API layer + SDKs + infrastructure + rename. Web now has a clear path to a clean build (Next 15.3.1 pin). Mobile is launch-viable after the generator run + the small remaining polish items (nullability guards, provider method alignment in logs_screen, theme, etc.).

Follow the updated blockers list in this file + the new AWS/CDN sections in DEPLOYMENT.md. Re-run `pnpm install && pnpm --filter @logstack/web build` + `cd apps/mobile && flutter pub get && dart run build_runner build --delete-conflicting-outputs && flutter analyze` after the version pin lands, then do an end-to-end smoke on a launched EC2 instance (or local compose) with real secrets. Update this tracker + commit with Co-Authored-By when green.

See also the new content in `infra/aws/`, `infra/nginx/nginx.conf`, `docs/DEPLOYMENT.md`, web `next.config.mjs`, and the mobile screens/theme fixes.

See also: docs/DEPLOYMENT.md, apps/web/content/docs/deployment/production-checklist.mdx, and the production section of this tracker.
