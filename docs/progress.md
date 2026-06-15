# Logstack — Stabilization & Publish Progress

> Live tracker for the current effort. Updated as work lands.
> Started: 2026-06-13 · Legend: ✅ done · 🔄 in progress · ⏳ pending · ⏸ blocked (needs input)
>
> Note: the previous tracker (claiming "28/30, 93%", dated May 6 2026) was inaccurate vs. the
> actual code state and has been replaced. Trust code over historical claims.

## Phase 0 — Deliverables & tracker
| Item | Status | Notes |
| ---- | ------ | ----- |
| Go+TS skill | ✅ | `.claude/skills/go-and-typescript/SKILL.md` |
| CLAUDE.md | ✅ | repo root — layout, run steps, naming rule, gotchas |
| Fresh tracker | ✅ | this file |

## Phase 1 — Local logging works end-to-end
| Item | Status | Notes |
| ---- | ------ | ----- |
| `logger.ts` no longer no-ops without key | ✅ | console-only (`disabled`) fallback + single warning |
| SDK: decouple console vs send; `silent`/`disabled` flags; honor `consoleInProduction` | ✅ | sends in all envs when apiKey+endpoint set |
| SDK: fixed wrong ingest path `/api/v1/logs` → `/v1/logs` | ✅ | matched backend router; was a 404 |
| SDK: offline-queue size cap | ✅ | `maxOfflineQueueSize`, default 1000 |
| Backend ingestor persists non-production logs | ✅ | all envs queryable; usage metered prod-only |
| Rebuild SDK `dist/` | ✅ | tsup build + vitest pass |
| Verified | ✅ | SDK build+test, Go build/vet/test, web type-check, Node console smoke test all pass. Full stack e2e (dev project→log→dashboard) recommended as manual check once stack is up. |

## Phase 2 — Dashboard → project journey
| Item | Status | Notes |
| ---- | ------ | ----- |
| Post-login redirect to dashboard | ✅ | already redirects to `/logs` (was a stale poor.md item) |
| Audit double-`/v1` | ✅ | already correct in code (stale poor.md item) |
| WebSocket auth works for browsers | ✅ | new `WSAuth` reads token from `Sec-WebSocket-Protocol`/`?token=`; `JWTAuth` header-only auth could never authenticate a browser socket |
| WebSocket endpoint decoupled from `/mobile` | ✅ | new `/v1/stream`; hook updated; `/v1/mobile/stream` kept for native |
| Projects query error surfaced | ✅ | `useProject` now exposes `error` instead of silent `[]` |
| Dedicated logs viewer page (list + filters + realtime, dedupe, cap) | ✅ | `/logs` now the viewer (paginated query + live WS, dedupe by id, cap 500); stats moved to `/overview` + nav item; post-login + marketing "Dashboard" → `/overview` |
| API key view/rotate after creation | ✅ | rotate now shows key in the secure modal (was a dismissible toast) |

## Phase 3 — SDK correctness + publish
| Item | Status | Notes |
| ---- | ------ | ----- |
| SDK behavior/endpoints sweep (JS/Go/Python) | ✅ | Fixed ingest path in all three (`/v1/logs/batch`→`/v1/logs`, JS `/api/v1/logs`→`/v1/logs`); Go now accepts 201, no lock held over network I/O, wrapped errors; Python uses `logging` not `print` |
| LICENSE files (root + per package) | ✅ | MIT, Mosesedem, at root + js/go-sdk/python |
| JS package.json metadata | ✅ | repository/homepage/bugs/author/publishConfig/exports; `npm pack` ships LICENSE+README+dist |
| Python pyproject.toml + version 1.0.0 | ✅ | added pyproject.toml; bumped setup.py + `__version__` to 1.0.0; fixed repo URL casing |
| Go module path resolution | ✅ | `github.com/Mosesedem/logstack/packages/logship-go-sdk` (monorepo subdir); READMEs updated |
| Publish (npm/PyPI/Go) | ⏸ | **Needs your credentials** — see note below |

## Phase 4 — Landing forced-dark + theme reconcile
| Item | Status | Notes |
| ---- | ------ | ----- |
| `(home)/layout.tsx` forced dark | ✅ | deterministic `dark` wrapper div (no next-themes race/flash) |
| `(auth)/layout.tsx` forced dark | ✅ | consistent dark brand; was forced light |
| Remove dead Radix theme imports | ✅ | dropped `@radix-ui/themes` Theme/ThemePanel + unused ThemeProvider from root layout |
| Reconcile theme systems, no flash | ✅ | landing/auth/dashboard all use the CSS `dark` class pattern; fumadocs RootProvider still owns docs theming. Visual confirm pending runtime. |

## Phase 5 — Docs cleanup
| Item | Status | Notes |
| ---- | ------ | ----- |
| Remove stale docs | ✅ | deleted complete_plan.md, poor.md, product_update.md, VIBECODERS.md (git-recoverable) |
| Update reference docs | ✅ | README index rewritten (also dropped dead DESIGN_GUIDE link); API.md ingest response (`persisted`) + `/v1/stream` endpoint + levels; SDK.md new config flags/behavior + debug/fatal levels. BACKEND/DEPLOYMENT/FCM/CONTRIBUTING spot-checked — no stale behavior. |

## Change log
| Date | Change |
| ---- | ------ |
| 2026-06-13 | Phase 0: added go-and-typescript skill, root CLAUDE.md, replaced stale tracker |
| 2026-06-13 | Phase 1: fixed dashboard no-op logger; decoupled SDK console/send + silent/disabled/queue-cap; fixed SDK ingest path `/api/v1/logs`→`/v1/logs`; backend persists all-env logs; rebuilt SDK. Verified via builds/tests/type-check/Node smoke. |
| 2026-06-13 | Phase 2 (core): added `WSAuth` (browser WebSocket token via subprotocol/query); decoupled `/v1/stream` from `/mobile`; updated web hook; surfaced projects-query errors. Audit `/v1/v1` and post-login redirect were already correct. |
| 2026-06-13 | Phase 4: landing + auth forced dark via `dark` wrapper; removed dead Radix theme imports. |
| 2026-06-13 | Phase 2 (logs viewer): `/logs` now real viewer (paginated + live WS, dedupe, cap); stats → `/overview` + nav; key rotate uses secure modal. |
| 2026-06-13 | Phase 5: deleted 4 stale docs; refreshed README/API.md/SDK.md. |
| 2026-06-13 | Phase 3: fixed ingest-path/status bugs in Go+Python SDKs; Go lock-over-IO fix; LICENSE×4; JS metadata; Python pyproject+v1.0.0; Go module path; self-contained READMEs. Publish pending credentials. |

---

## Publishing — what's needed from you

All three SDKs are prepared and build clean. To actually publish (you chose publish-all):

- **npm (`logstack-js`)**: `npm login` (or an `NPM_TOKEN`). Then from `packages/logship-js`:
  `npm publish` (package is public via `publishConfig`). Verify the name `logstack-js` is
  available/owned by you.
- **PyPI (`logstack`)**: a PyPI API token. Build with `python -m build` (needs `pip install build`)
  from `packages/logship-python`, then `twine upload dist/*`. Verify the name `logstack` is
  available on PyPI.
- **Go**: no registry push — pkg.go.dev indexes from a Git tag. Since the module lives in a
  subdir, the tag must be path-scoped, e.g. `packages/logship-go-sdk/v1.0.0`. Push that tag to
  `github.com/Mosesedem/logstack` and the module resolves for `go get`.

I paused here rather than guessing credentials. Tell me when you're authed (or provide tokens)
and which to publish, and I'll run them.
