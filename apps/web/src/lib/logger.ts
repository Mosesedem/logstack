import { createLogStack } from "logstack-js";
import type { LogStackClient } from "logstack-js";

declare const process: {
  env: {
    NEXT_PUBLIC_LOGSTACK_API_KEY?: string;
  };
};

const noopLogstack: LogStackClient = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {},
  fatal: () => {},
  log: () => {},
  flush: async () => {},
  close: async () => {},
  setContext: () => {},
  clearContext: () => {},
  getLogs: async () => ({ logs: [], total: 0, offset: 0, limit: 0 }),
  getLogById: async () => ({
    id: 0,
    projectId: "",
    createdAt: new Date().toISOString(),
    level: "info",
    message: "",
  }),
};

let logstack: LogStackClient = noopLogstack;

if (!process.env.NEXT_PUBLIC_LOGSTACK_API_KEY) {
  console.warn("Logstack API key is not set. Logging will be disabled.");
} else {
  logstack = createLogStack({
    apiKey: process.env.NEXT_PUBLIC_LOGSTACK_API_KEY,
  });
}

export { logstack };
