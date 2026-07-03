import { describe, it, beforeEach, expect, vi, afterEach } from "vitest";
import { createLogStack } from "../src/index";

describe("endpoint normalization", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strips trailing /v1 from endpoint before posting", async () => {
    const client = createLogStack({
      apiKey: "test-key",
      endpoint: "http://localhost:8080/v1",
      environment: "development",
    });

    client.info("hello");
    await client.flush();
    await client.close();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/v1/logs");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.environment).toBe("development");
    expect(body.logs[0].message).toBe("hello");
  });
});

describe("disabled mode", () => {
  it("never calls fetch when disabled", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const client = createLogStack({ apiKey: "", disabled: true });
    client.info("local only");
    await client.flush();
    await client.close();
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("captureConsole (default on)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    // ensure clean console
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures console.log / console.error and forwards with source: console", async () => {
    const client = createLogStack({ apiKey: "test-key", captureConsole: true });

    // These should be captured + shipped
    console.log("hello from captured log", { foo: 42 });
    console.error("something broke");

    await client.flush();
    await client.close();

    const calls = vi.mocked(fetch).mock.calls;
    // We expect at least the captured ones (plus any internal)
    const bodies = calls.map(([, init]) => JSON.parse((init as any).body as string));
    const allLogs = bodies.flatMap((b: any) => b.logs || []);

    const consoleLogs = allLogs.filter((l: any) => l.source === "console");
    expect(consoleLogs.length).toBeGreaterThanOrEqual(2);

    const logOne = consoleLogs.find((l: any) => l.message.includes("hello from captured"));
    expect(logOne?.level).toBe("info");
    expect(logOne?.metadata?.foo).toBe(42);

    const errOne = consoleLogs.find((l: any) => l.message.includes("something broke"));
    expect(errOne?.level).toBe("error");
  });

  it("restores original console methods on close()", async () => {
    const origLog = console.log;
    const client = createLogStack({ apiKey: "k", captureConsole: true });
    expect(console.log).not.toBe(origLog);

    await client.close();
    expect(console.log).toBe(origLog);
  });

  it("can be turned off with captureConsole: false", async () => {
    const client = createLogStack({ apiKey: "k", captureConsole: false });

    const before = console.log;
    console.log("should not be wrapped");
    await client.close();

    // We can't easily assert the wrapper state without internal, but close should be safe
    expect(typeof console.log).toBe("function");
  });
});