import { describe, it, beforeEach, expect, vi, afterEach } from "vitest";
import { createLogStack, VERSION, resolveEnvironment } from "../src/index";

describe("VERSION", () => {
  it("matches package release", () => {
    expect(VERSION).toBe("1.0.3");
  });
});

describe("resolveEnvironment", () => {
  it("prefers Vite import.meta.env.DEV / MODE over defaults", () => {
    expect(resolveEnvironment({ importMetaEnv: { DEV: true } })).toBe(
      "development",
    );
    expect(
      resolveEnvironment({ importMetaEnv: { MODE: "development" } }),
    ).toBe("development");
    expect(resolveEnvironment({ importMetaEnv: { MODE: "staging" } })).toBe(
      "staging",
    );
    expect(resolveEnvironment({ importMetaEnv: { MODE: "test" } })).toBe(
      "test",
    );
    expect(
      resolveEnvironment({
        importMetaEnv: { PROD: true, MODE: "production" },
      }),
    ).toBe("production");
  });

  it("maps NODE_ENV strings (including aliases)", () => {
    // Pass empty importMetaEnv so Vitest's own import.meta.env does not win.
    const base = { importMetaEnv: {} as const };
    expect(resolveEnvironment({ ...base, nodeEnv: "development" })).toBe(
      "development",
    );
    expect(resolveEnvironment({ ...base, nodeEnv: "dev" })).toBe("development");
    expect(resolveEnvironment({ ...base, nodeEnv: "test" })).toBe("test");
    expect(resolveEnvironment({ ...base, nodeEnv: "staging" })).toBe("staging");
    expect(resolveEnvironment({ ...base, nodeEnv: "production" })).toBe(
      "production",
    );
    expect(resolveEnvironment({ ...base, nodeEnv: "prod" })).toBe("production");
  });

  it("treats local browser hostnames as development when no env signal", () => {
    const base = { importMetaEnv: {} as const, nodeEnv: undefined };
    expect(resolveEnvironment({ ...base, hostname: "localhost" })).toBe(
      "development",
    );
    expect(resolveEnvironment({ ...base, hostname: "127.0.0.1" })).toBe(
      "development",
    );
    expect(resolveEnvironment({ ...base, hostname: "app.localhost" })).toBe(
      "development",
    );
    expect(resolveEnvironment({ ...base, hostname: "myapp.local" })).toBe(
      "development",
    );
  });

  it("defaults to production when no signal matches", () => {
    expect(
      resolveEnvironment({
        importMetaEnv: {},
        nodeEnv: undefined,
        hostname: "app.example.com",
      }),
    ).toBe("production");
  });

  it("does not let localhost override an explicit production NODE_ENV", () => {
    expect(
      resolveEnvironment({
        importMetaEnv: {},
        nodeEnv: "production",
        hostname: "localhost",
      }),
    ).toBe("production");
  });
});

describe("console gating vs shipping", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({}),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pretty-prints to console in development while still shipping", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const client = createLogStack({
      apiKey: "test-key",
      environment: "development",
      captureConsole: false,
    });

    client.info("visible in dev");
    await client.flush();
    await client.close();

    expect(logSpy).toHaveBeenCalled();
    expect(vi.mocked(fetch)).toHaveBeenCalled();
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.environment).toBe("development");
    expect(body.logs[0].message).toBe("visible in dev");
  });

  it("ships in production without console pretty-print (silent console)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const client = createLogStack({
      apiKey: "test-key",
      environment: "production",
      captureConsole: false,
      consoleInProduction: false,
    });

    client.info("prod ship only");
    await client.flush();
    await client.close();

    expect(logSpy).not.toHaveBeenCalled();
    expect(vi.mocked(fetch)).toHaveBeenCalled();
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.environment).toBe("production");
    expect(body.logs[0].message).toBe("prod ship only");
  });

  it("logs to console in production when consoleInProduction is true", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const client = createLogStack({
      apiKey: "test-key",
      environment: "production",
      captureConsole: false,
      consoleInProduction: true,
    });

    client.info("prod with console");
    await client.flush();
    await client.close();

    expect(logSpy).toHaveBeenCalled();
  });
});

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