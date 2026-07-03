import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geminiJson } from "./geminiServer";

// Minimal Response-like stubs for the mocked fetch.
function ok(text: string, finishReason = "STOP") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }),
  };
}
function err(status: number, statusText = "Error") {
  return { ok: false, status, statusText, json: async () => ({}) };
}

describe("geminiJson", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("throws when the API key is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(geminiJson({ parts: [{ text: "hi" }] })).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("returns text, finishReason, and model on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok("[]", "STOP"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await geminiJson({ parts: [{ text: "solve" }], baseDelayMs: 0 });
    expect(res).toEqual({ text: "[]", finishReason: "STOP", model: "gemini-2.5-flash" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // JSON output + key are wired into the request; thinking off by default
    // (thinking tokens count against maxOutputTokens and can starve the JSON).
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("gemini-2.5-flash:generateContent?key=test-key");
    const cfg = JSON.parse(init.body).generationConfig;
    expect(cfg.responseMimeType).toBe("application/json");
    expect(cfg.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("surfaces a partial MAX_TOKENS response instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok('[{"a":1', "MAX_TOKENS")));
    const res = await geminiJson({ parts: [{ text: "x" }], baseDelayMs: 0 });
    expect(res.finishReason).toBe("MAX_TOKENS");
    expect(res.text).toBe('[{"a":1');
  });

  it("retries the same model on 429, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(429, "Too Many Requests"))
      .mockResolvedValueOnce(ok("[]"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await geminiJson({ parts: [{ text: "x" }], baseDelayMs: 0 });
    expect(res.model).toBe("gemini-2.5-flash");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([u]) => String(u).includes("gemini-2.5-flash:"))).toBe(true);
  });

  it("falls back to the next model when the first is exhausted by 429s", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(429))
      .mockResolvedValueOnce(err(429))
      .mockResolvedValueOnce(ok("[]"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await geminiJson({ parts: [{ text: "x" }], maxRetriesPerModel: 2, baseDelayMs: 0 });
    expect(res.model).toBe("gemini-2.5-flash-lite");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("skips straight to the next model on a non-transient 4xx error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(400, "Bad Request"))
      .mockResolvedValueOnce(ok("[]"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await geminiJson({ parts: [{ text: "x" }], maxRetriesPerModel: 3, baseDelayMs: 0 });
    expect(res.model).toBe("gemini-2.5-flash-lite");
    // Only one attempt on model 0 (no retry for hard 4xx), then success on model 1.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries the same model on 5xx overload before falling back", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(503, "Service Unavailable"))
      .mockResolvedValueOnce(ok("[]"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await geminiJson({ parts: [{ text: "x" }], baseDelayMs: 0 });
    expect(res.model).toBe("gemini-2.5-flash");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after every model and attempt fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(err(503, "Unavailable")));
    await expect(
      geminiJson({ parts: [{ text: "x" }], maxRetriesPerModel: 1, baseDelayMs: 0 }),
    ).rejects.toThrow(/503/);
  });

  it("retries the same model on a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(ok("[]"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await geminiJson({ parts: [{ text: "x" }], baseDelayMs: 0 });
    expect(res.model).toBe("gemini-2.5-flash");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
