import { describe, expect, it } from "vitest";
import { buildAlternatives, buildOptimizedRoute, canAttendAfter, createRecommendationItems } from "./scheduler";
import type { AgendaSession, GeminiRecommendation, RecommendRequest } from "./types";

const baseSession: Omit<AgendaSession, "id" | "stage" | "startMinutes" | "endMinutes" | "startTime" | "endTime" | "title"> = {
  date: "2026-07-13",
  dayLabel: "7/13",
  language: "EN",
  speakers: [],
  categories: [],
  rawText: "",
  isPlaceholder: false,
};

function session(id: string, stage: AgendaSession["stage"], startMinutes: number, endMinutes: number, title: string): AgendaSession {
  return {
    ...baseSession,
    id,
    stage,
    startMinutes,
    endMinutes,
    startTime: `${startMinutes}`,
    endTime: `${endMinutes}`,
    title,
  };
}

const request: RecommendRequest = {
  mode: "diagnostic",
  locale: "ja",
  basics: {
    days: ["2026-07-13"],
    language: "both",
    density: "balanced",
  },
  diagnostic: {
    topics: ["ai"],
    role: "business",
    goals: ["market_trends"],
  },
};

describe("scheduler", () => {
  it("requires movement buffer across stages", () => {
    expect(canAttendAfter(session("a", "CRYL Stage", 600, 640, "A"), session("b", "Binance Stage", 642, 680, "B"))).toBe(false);
    expect(canAttendAfter(session("a", "CRYL Stage", 600, 640, "A"), session("b", "Binance Stage", 645, 680, "B"))).toBe(true);
  });

  it("builds a route without overlapping sessions", () => {
    const sessions = [
      session("a", "CRYL Stage", 600, 640, "High score A"),
      session("b", "Binance Stage", 620, 660, "Overlaps A"),
      session("c", "Binance Stage", 670, 700, "After A with buffer"),
    ];
    const ai: GeminiRecommendation = {
      profileTags: ["ai"],
      summary: "",
      sessionScores: [
        { sessionId: "a", score: 90, reason: "A", note: "", matchedThemes: ["ai"] },
        { sessionId: "b", score: 85, reason: "B", note: "", matchedThemes: ["ai"] },
        { sessionId: "c", score: 80, reason: "C", note: "", matchedThemes: ["ai"] },
      ],
    };

    const items = createRecommendationItems(sessions, ai, request);
    const route = buildOptimizedRoute(items, "balanced");
    const ids = route.map((item) => item.id);

    expect(ids).toContain("a");
    expect(ids).toContain("c");
    expect(ids).not.toContain("b");
  });

  it("labels alternatives with conflicting selected session", () => {
    const sessions = [
      session("a", "CRYL Stage", 600, 640, "Selected"),
      session("b", "Binance Stage", 620, 660, "Alternative"),
    ];
    const ai: GeminiRecommendation = {
      profileTags: ["ai"],
      summary: "",
      sessionScores: [
        { sessionId: "a", score: 90, reason: "A", note: "", matchedThemes: ["ai"] },
        { sessionId: "b", score: 88, reason: "B", note: "", matchedThemes: ["ai"] },
      ],
    };

    const items = createRecommendationItems(sessions, ai, request);
    const route = buildOptimizedRoute(items, "relaxed");
    const alternatives = buildAlternatives(items, route);

    expect(alternatives[0].conflictWith).toBe("Selected");
  });
});
