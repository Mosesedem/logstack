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