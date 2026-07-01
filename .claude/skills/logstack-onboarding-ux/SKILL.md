---
name: logstack-onboarding-ux
description: >
  Ultimate playbook for Logstack user onboarding: project creation wizard, alert
  setup, SDK connection, and patching poor UX. Use when fixing project creation,
  alert onboarding, setup alerts flow, golden path, first-run experience, or
  when onboarding feels rigid, broken, or incomplete. Complements logstack-web-api.
---

# Logstack Onboarding UX — Ultimate Playbook

This skill governs **how users go from zero to logs + alerts flowing**. Read it
before touching project creation, alert setup, or first-run flows.

**Companion skills:**
- `logstack-web-api` — API wiring, notifications, SDK ingestion
- `go-and-typescript` — code style

---

## Golden path (non-negotiable)

```
Sign up → (verify email banner) → Create project
  → Wizard: API key → Customize alert → SDK snippet
  → Logs in dashboard → Alerts fire → Notifications delivered
```

The **Alerts page** is for ongoing **edit/add** — not the first-time setup.
First-time setup happens **inside the project creation wizard**.

---

## Architecture

### Components (canonical)

| Component | Role |
|-----------|------|
| `project-onboarding-wizard.tsx` | 3-step wizard after **new** project create only |
| `api-key-reveal-dialog.tsx` | One-off key display for **rotate key** only |
| `alert-form-fields.tsx` | Shared alert form (used by wizard + alerts page) |
| `alert-form.tsx` | Dialog wrapper around `AlertFormFields` |
| `projects/page.tsx` | Create project → opens wizard; rotate → reveal dialog |

### Wizard steps

1. **API key** — copy + explicit acknowledgment checkbox before continue
2. **Alerts** — full `AlertFormFields` (not a read-only summary)
3. **SDK** — install command + init snippet with real key; links to `/demo` or `/logs`

### State rules

| Event | Correct behavior |
|-------|------------------|
| Project created | `setCurrentProject(project)` immediately |
| Wizard closed | Keep selected project; clear wizard state only |
| Key rotated | `ApiKeyRevealDialog` only — **never** open full wizard |
| Alert saved in wizard | `invalidateQueries(['alerts'])`, advance to SDK step |
| Wizard complete | `setCurrentProject`, navigate to `/logs` or `/demo` |

---

## Audit checklist (run before claiming done)

### Project creation wizard

- [ ] Step progress indicator visible (1/2/3 + progress bar)
- [ ] API key step requires "I've copied" before continue
- [ ] Alert step uses `AlertFormFields` — user can edit name, level, patterns, channels, recipient, cooldown
- [ ] Alert step validates: name, ≥1 channel, recipient when email/webhook
- [ ] Skip alerts → still shows SDK step (don't abandon user)
- [ ] SDK step shows copyable snippet with **actual** API key and correct endpoint
- [ ] Back navigation works between steps
- [ ] New project is `currentProject` before user leaves wizard

### Alerts page (post-onboarding)

- [ ] Empty state has "Create your first alert" CTA
- [ ] Edit uses same `AlertFormFields` via `AlertForm`
- [ ] History tab shows delivery status
- [ ] `defaultRecipient` = session email on create

### Anti-patterns (never ship these)

| Anti-pattern | Why it's wrong |
|--------------|----------------|
| Read-only alert summary on onboarding | User can't customize; feels rigid |
| Single "Enable error alerts" button | Hides channels, patterns, cooldown |
| Reusing wizard for key rotation | Rotation is a 1-step reveal, not onboarding |
| Not setting `currentProject` after create | Logs/alerts pages show wrong or empty project |
| Duplicate alert form logic | Wizard and alerts page drift apart |
| Closing wizard without selecting project | User lands on dashboard with stale project context |
| Hardcoded alert payload in wizard | Use `buildDefaultAlertFormData()` with smart defaults |

---

## Default alert presets (wizard step 2)

Pre-fill via `buildDefaultAlertFormData()`:

```typescript
{
  name: `${project.name} alerts`,
  triggerLevel: "error",
  triggerPatterns: [".*error.*", ".*exception.*"],
  channels: ["email"],
  recipient: session.user.email,
  cooldownMinutes: 15,
  enabled: true,
}
```

User may change everything before saving.

---

## Known gaps to watch (backend + product)

| Gap | Impact | Patch direction |
|-----|--------|-----------------|
| Alert processor polls every 5s | Delay before first notification | Document in UI; future: hook ingest |
| Email verification not enforced on login | Unverified users can create projects | Banner + optional API gate |
| Push-only alerts need mobile app | Wizard should explain push channel | Copy in `AlertFormFields` |
| OAuth users without email | Email channel disabled | Show inline warning; suggest webhook |
| No "test alert" button | User can't verify delivery | Future: send test notification |
| `GET /v1/logs` uses API key, not JWT | Dashboard must use `/projects/:id/logs` | Don't wire dashboard to wrong endpoint |

---

## File map

```
apps/web/src/
  components/projects/
    project-onboarding-wizard.tsx   # 3-step wizard
    api-key-reveal-dialog.tsx       # rotate-key only
  components/alerts/
    alert-form-fields.tsx           # shared fields + validation
    alert-form.tsx                  # edit/create dialog
  app/(dashboard)/projects/page.tsx
  app/(dashboard)/alerts/page.tsx
  hooks/use-project.tsx             # currentProject + localStorage sync
```

---

## Implementation recipe (new feature in onboarding)

1. **Read** this skill + `logstack-web-api` golden path section
2. **Identify** which step of the wizard is affected (key / alerts / sdk)
3. **Reuse** `AlertFormFields` — never duplicate form fields
4. **Validate** with `validateAlertFormData()` before API calls
5. **Update** `setCurrentProject` when project context changes
6. **Invalidate** React Query caches: `projects`, `alerts`
7. **Test manually:**
   - Create project → complete wizard
   - Skip alerts → SDK step still works
   - Rotate key → reveal dialog only
   - Edit alert on `/alerts` → same fields as wizard
8. **Run** `pnpm --filter @logstack/web type-check`

---

## Verification script (manual)

1. Create project "Test Onboarding"
2. Confirm wizard step 1 blocks continue until key copied
3. On step 2: change alert name, add `push` channel, save
4. On step 3: copy SDK snippet, finish → `/logs`
5. Confirm sidebar shows "Test Onboarding" as selected project
6. Rotate key on projects page → simple dialog, **not** wizard
7. `/alerts` → rule from step 2 is listed and editable

---

## When overhauling

If onboarding is "terrible" or "rigid", assume one or more of:

1. Wizard shows static text instead of real form
2. Key rotation triggers wrong modal
3. Project context not updated after create
4. Alert form duplicated with different defaults/validation
5. No SDK step — user doesn't know what to do after alerts

**Fix order:** project context → shared form → wizard steps → separate rotate dialog → docs/skills sync.