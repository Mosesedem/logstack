# Web Demo, Team, Audit & Mobile Linking Polish

## Goals
- Make /demo page the best place to test SDKs + API keys end-to-end (logs + email + push in realtime, including bursts).
- Fix /settings/team (handle 402 for free tiers gracefully) and /settings/audit (no more 500 for users without org).
- Auto-create personal organizations for new users in audit flows.
- Add "Link Mobile Device" section in main Settings for easy push/mobile testing.
- Ensure actual log data (not just simulated) triggers notifications when rules match.
- Burst items send logs realtime; test alerts can be bursted independently (bypass cooldown).

## Key Fixes
### Backend
- audit.go: Auto-create personal org on GetAuditLogs / GetResource if ErrOrganizationNotFound (prevents 500).
- Price gates on team/invites return 402 intentionally for low tiers — frontend now handles.
- Demo test notifications go through full notifier.Send (all rule channels: email + push + webhook).
- Real SDK logs in demo trigger alert_engine.ProcessLog + notifier (actual log data in emails).

### Web (apps/web)
- demo/page.tsx:
  - Clearer instructions + numbered flow.
  - "Create Demo Alert Rule (email + push)" button (auto-creates matching rule).
  - Unified "Send test alert (email + push if configured)".
  - "Send burst test alerts (realtime, bypasses cooldown)" — calls test 3x fast for multiple notifications.
  - Burst logs still realtime (SDK path); alerts may throttle but tests don't.
- settings/team/page.tsx: Catches 402 on invites, shows friendly "upgrade" instead of console errors.
- settings/page.tsx: Added "Link Mobile Device" card using existing LinkMobileDialog. Helps users register device for push testing from /demo.
- audit/page.tsx: Benefits from backend auto-org fix (no 500s).

### Usage for Testing SDKs
1. Create project → copy ls_ key.
2. Paste in /demo.
3. (Optional) Click "Create Demo Alert Rule".
4. Send "Payment failed" log → appears in /logs realtime.
5. Click test/burst buttons → email to recipient + push to linked mobile.
6. Verify in inbox + mobile app + /logs + alert history.

Bursts: SDK logs arrive instantly; use burst test alerts for multiple realtime notifications without waiting cooldown.

## Mobile Linking
Settings now has direct access to QR/PIN for linking mobile (push + logs + auth). After link + enable push in mobile, /demo bursts will deliver push in realtime.

## Notes
- Push requires: FCM service account + APNs key (iOS) + mobile device with push token registered for the user.
- 402 on team features = upgrade (intentional).
- Cooldown still applies to real matching logs (demo burst tests bypass for UX).
- Polish keeps backward compat with old /test-email route.

Run `pnpm --filter @logstack/web dev` + backend to test. Use real key from project with alerts enabled.
