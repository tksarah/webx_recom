import { describe, expect, it } from "vitest";
import { recommendRequestSchema } from "./types";

describe("recommendRequestSchema", () => {
  it("accepts one non-space character for free text mode", () => {
    const result = recommendRequestSchema.safeParse({
      mode: "freeText",
      basics: {
        days: ["2026-07-13"],
        language: "both",
        density: "balanced",
      },
      freeText: "A",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.locale).toBe("ja");
  });

  it("accepts English UI locale", () => {
    const result = recommendRequestSchema.safeParse({
      mode: "freeText",
      locale: "en",
      basics: {
        days: ["2026-07-13"],
        language: "both",
        density: "balanced",
      },
      freeText: "A",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.locale).toBe("en");
  });

  it("rejects blank free text mode input", () => {
    const result = recommendRequestSchema.safeParse({
      mode: "freeText",
      basics: {
        days: ["2026-07-13"],
        language: "both",
        density: "balanced",
      },
      freeText: "   ",
    });

    expect(result.success).toBe(false);
  });
});
