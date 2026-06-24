import { describe, expect, it } from "vitest";
import { renderRecommendationPdf } from "./pdf";
import type { RecommendationResult } from "./types";

describe("renderRecommendationPdf", () => {
  it("generates a readable simple PDF within two pages", async () => {
    const result: RecommendationResult = {
      requestSummary: {
        mode: "diagnostic",
        locale: "ja",
        topics: ["ai", "stablecoin"],
        role: "business",
        goals: ["market_trends"],
        days: ["2026-07-13", "2026-07-14"],
        language: "both",
        density: "balanced",
        generatedAt: "2026-06-24T00:00:00.000Z",
      },
      agendaUpdatedAt: "2026-06-24T00:00:00.000Z",
      model: { name: "gemini-3.1-flash-lite", source: "local-fallback", latencyMs: 5 },
      profileTags: ["ai", "stablecoin"],
      summary: "参加目的に合わせて、AIと決済テーマを中心に整理したルートです。",
      route: [
        {
          id: "test-ja",
          date: "2026-07-13",
          dayLabel: "7/13",
          language: "JA",
          stage: "Binance Stage",
          startTime: "10:00 AM",
          endTime: "10:30 AM",
          startMinutes: 600,
          endMinutes: 630,
          title: "日本語セッション: AI時代のステーブルコイン決済",
          speakers: ["山田 太郎 / Example Bank / Director"],
          categories: [],
          rawText: "日本語セッション: AI時代のステーブルコイン決済",
          isPlaceholder: false,
          score: 88,
          reason: "日本語を含む長めの推薦理由が、カード内で折り返されて読みやすく表示されることを確認します。",
          note: "",
          matchedThemes: ["ai", "stablecoin"],
        },
        {
          id: "test-en",
          date: "2026-07-13",
          dayLabel: "7/13",
          language: "EN",
          stage: "CRYL Stage",
          startTime: "10:40 AM",
          endTime: "11:20 AM",
          startMinutes: 640,
          endMinutes: 680,
          title: "The Autonomous Economy: How Crypto, AI Agents, and Next-Gen Infrastructure Are Converging",
          speakers: [],
          categories: [],
          rawText: "The Autonomous Economy",
          isPlaceholder: false,
          score: 84,
          reason: "Long English titles and body copy should remain inside the card without clipping.",
          note: "",
          matchedThemes: ["ai"],
          moveFromPrevious: {
            fromStage: "Binance Stage",
            minutes: 5,
          },
        },
      ],
      recommendations: [],
      alternatives: [
        {
          id: "alt",
          date: "2026-07-13",
          dayLabel: "7/13",
          language: "EN",
          stage: "Visionary Stage",
          startTime: "10:05 AM",
          endTime: "10:35 AM",
          startMinutes: 605,
          endMinutes: 635,
          title: "Alternative Session with a Conflicting Time Slot",
          speakers: [],
          categories: [],
          rawText: "Alternative Session",
          isPlaceholder: false,
          score: 80,
          reason: "Alternative reason",
          note: "",
          matchedThemes: ["ai"],
          conflictWith: "日本語セッション: AI時代のステーブルコイン決済",
        },
      ],
      notes: ["同時刻のセッションは1つだけ選びます。"],
    };

    const pdf = await renderRecommendationPdf(result);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2500);
    expect(countPages(pdf)).toBeLessThanOrEqual(2);

    const englishPdf = await renderRecommendationPdf({
      ...result,
      requestSummary: { ...result.requestSummary, locale: "en" },
      summary: "A readable English route summary.",
      notes: ["Only one session is selected for overlapping time slots."],
    });
    expect(englishPdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(countPages(englishPdf)).toBeLessThanOrEqual(2);

    const crowdedPdf = await renderRecommendationPdf({
      ...result,
      route: Array.from({ length: 16 }, (_, index) => ({
        ...result.route[index % result.route.length],
        id: `route-${index}`,
        startTime: `${10 + Math.floor(index / 2)}:${index % 2 === 0 ? "00" : "30"} AM`,
        title: `${result.route[index % result.route.length].title} ${index} with an intentionally long title to verify clipping instead of overlap`,
        speakers: index % 3 === 0 ? [] : [`Speaker ${index} / Example Company / Partner`],
      })),
      alternatives: Array.from({ length: 8 }, (_, index) => ({
        ...result.alternatives[0],
        id: `alt-${index}`,
        title: `${result.alternatives[0].title} ${index}`,
      })),
    });
    expect(countPages(crowdedPdf)).toBeLessThanOrEqual(2);
  });
});

function countPages(pdf: Buffer): number {
  return pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}
