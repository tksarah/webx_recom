import { describe, expect, it } from "vitest";
import { buildAnalyticsEntry } from "./analytics";
import type { RecommendationResult, RecommendRequest } from "./types";

describe("analytics", () => {
  it("does not persist free text content", () => {
    const request: RecommendRequest = {
      mode: "freeText",
      locale: "ja",
      basics: {
        days: ["2026-07-13"],
        language: "both",
        density: "balanced",
      },
      freeText: "この文章は保存されてはいけない秘密の参加目的です",
    };

    const result = {
      requestSummary: {
        mode: "freeText",
        locale: "ja",
        topics: ["ai"],
        goals: [],
        days: ["2026-07-13"],
        language: "both",
        density: "balanced",
        generatedAt: "2026-06-24T00:00:00.000Z",
      },
      agendaUpdatedAt: "2026-06-24T00:00:00.000Z",
      model: { name: "gemini-3.1-flash-lite", source: "local-fallback", latencyMs: 12 },
      profileTags: ["ai"],
      summary: "",
      route: [],
      recommendations: [],
      alternatives: [],
      notes: [],
    } satisfies RecommendationResult;

    const serialized = JSON.stringify(buildAnalyticsEntry(request, result));
    expect(serialized).not.toContain("秘密の参加目的");
    expect(serialized).toContain("ai");
  });
});
