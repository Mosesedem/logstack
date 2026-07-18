import { describe, it, beforeEach, expect } from "vitest";
import { createLogStack } from "../src/index";

// Simple localStorage mock
class LocalStorageMock {
  store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// Simple window mock with addEventListener support
class WindowMock {
  navigator = { onLine: false };
  // Non-local hostname so resolveEnvironment does not force "development"
  location = {
    href: "https://app.example.com/",
    pathname: "/",
    hostname: "app.example.com",
  };
  listeners: Record<string, Function[]> = { online: [], offline: [] };

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback,
      );
    }
  }
}

beforeEach(() => {
  // Setup a browser-like global with proper mocks.
  // Do not assign globalThis.navigator — it is a read-only getter in modern Node.
  const windowMock = new WindowMock();
  (globalThis as any).window = windowMock;
  (globalThis as any).localStorage = new LocalStorageMock();
});

describe("offline queue", () => {
  it("queues logs to localStorage when offline", () => {
    const client = createLogStack({
      apiKey: "test-key",
      environment: "production",
    });

    client.info("offline test", { foo: "bar" });

    const stored = (globalThis as any).localStorage.getItem(
      "logstack_offline_queue",
    );
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0].message).toBe("offline test");
  });
});
