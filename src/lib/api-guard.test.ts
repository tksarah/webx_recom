import { describe, expect, it } from "vitest";
import { ApiRequestError, checkRateLimit, readJsonBody } from "./api-guard";

describe("api guard", () => {
  it("reads JSON bodies within the configured limit", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });

    await expect(readJsonBody(request, 1024)).resolves.toEqual({ ok: true });
  });

  it("rejects unsupported content types", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });

    await expect(readJsonBody(request, 1024)).rejects.toMatchObject<ApiRequestError>({
      status: 415,
      code: "unsupported_media_type",
    });
  });

  it("rejects oversized request bodies", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "too large" }),
    });

    await expect(readJsonBody(request, 8)).rejects.toMatchObject<ApiRequestError>({
      status: 413,
      code: "payload_too_large",
    });
  });

  it("limits repeated requests from the same client", () => {
    const namespace = `test-${crypto.randomUUID()}`;
    const request = new Request("https://example.test/api", {
      headers: { "X-Forwarded-For": "192.0.2.10" },
    });
    const options = { namespace, maxRequests: 2, windowMs: 60_000 };

    expect(checkRateLimit(request, options)).toEqual({ allowed: true });
    expect(checkRateLimit(request, options)).toEqual({ allowed: true });
    expect(checkRateLimit(request, options)).toMatchObject({ allowed: false });
  });
});
