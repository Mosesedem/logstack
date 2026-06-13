import { createLogStack } from "logstack-js";
import type { LogStackClient } from "logstack-js";

declare const process: {
  env: {
    NEXT_PUBLIC_LOGSTACK_API_KEY?: string;
    NEXT_PUBLIC_API_URL?: string;
  };
};

const apiKey = process.env.NEXT_PUBLIC_LOGSTACK_API_KEY;

// The SDK appends `/v1/logs` to its endpoint, while NEXT_PUBLIC_API_URL already
// ends in `/v1` (it is the apiClient base). Strip the trailing `/v1` so the SDK
// builds the correct ingestion URL.
const endpoint = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1"
).replace(/\/v1\/?$/, "");

// Always create a real client so console output works locally. When no API key
// is configured we run console-only (`disabled`) instead of silently dropping
// every call — that no-op fallback was the root cause of "console.log does not
// work" in local development.
if (!apiKey) {
  console.warn(
    "[logstack] NEXT_PUBLIC_LOGSTACK_API_KEY not set — logging to console only (logs are not shipped to the server).",
  );
}

const logstack: LogStackClient = createLogStack({
  apiKey: apiKey ?? "",
  endpoint,
  disabled: !apiKey,
});

export { logstack };
