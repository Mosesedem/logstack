import { createLogStack } from "logstack-js";
import type { LogStackClient } from "logstack-js";

declare const process: {
  env: {
    NEXT_PUBLIC_LOGSTACK_API_KEY?: string;
    NEXT_PUBLIC_API_URL?: string;
  };
};

const rawKey = (process.env.NEXT_PUBLIC_LOGSTACK_API_KEY ?? "").trim();
// Project API keys must start with ls_ (Bearer JWT will always 401 on /logs).
const apiKey = rawKey.startsWith("ls_") ? rawKey : "";

// The SDK appends `/v1/logs` to its endpoint, while NEXT_PUBLIC_API_URL already
// ends in `/v1` (it is the apiClient base). Strip the trailing `/v1` so the SDK
// builds the correct ingestion URL.
const endpoint = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1"
).replace(/\/v1\/?$/, "");

if (!apiKey) {
  if (rawKey) {
    console.warn(
      "[logstack] NEXT_PUBLIC_LOGSTACK_API_KEY is set but invalid (must start with ls_). Console-only mode — not shipping to /v1/logs.",
    );
  } else {
    console.warn(
      "[logstack] NEXT_PUBLIC_LOGSTACK_API_KEY not set — logging to console only (logs are not shipped to the server).",
    );
  }
}

let shippingDisabled = !apiKey;

const logstack: LogStackClient = createLogStack({
  apiKey: apiKey || "ls_disabled",
  endpoint,
  disabled: shippingDisabled,
  // captureConsole defaults to true: native console.* calls are automatically
  // captured + shipped (in addition to explicit logstack.* calls).
  captureConsole: true,
  onError: (err) => {
    // Auth failures should not spam the network console every flush interval.
    const status = (err as Error & { status?: number }).status;
    if (status === 401 || status === 403 || /unauthorized|invalid.?api.?key/i.test(err.message)) {
      if (!shippingDisabled) {
        shippingDisabled = true;
        console.warn(
          "[logstack] Ingest rejected (401/403) — stopping network shipping. Fix NEXT_PUBLIC_LOGSTACK_API_KEY (project key starting with ls_).",
        );
      }
    }
  },
});

export { logstack };
