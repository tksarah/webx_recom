import { describe, expect, it } from "vitest";
import { formatSideEventPdfTimeRange, renderSideEventRecommendationPdf } from "./side-event-pdf";
import type { SideEventRecommendationResult } from "./types";

type RouteEvent = SideEventRecommendationResult["route"][number];
type AlternativeEvent = SideEventRecommendationResult["alternatives"][number];

describe("renderSideEventRecommendationPdf", () => {
  it("formats side-event PDF time ranges with visible start and end times", () => {
    expect(formatSideEventPdfTimeRange({ dayLabel: "7/13", startMinutes: 18 * 60 + 30, endMinutes: 21 * 60 })).toBe(
      "7/13\n18:30-21:00",
    );
  });

  it("generates a side-event route PDF and keeps crowded output within two pages", async () => {
    const result = recommendationResult({
      route: [
        routeEvent("route-1", 18 * 60, 19 * 60, "Stablecoin investor dinner"),
        {
          ...routeEvent("route-2", 20 * 60, 21 * 60 + 30, "RWA founders mixer"),
          venueName: "Venue B",
          venueKey: "venue-b",
          moveFromPrevious: { fromVenue: "Venue A", minutes: 45 },
        },
      ],
      alternatives: [alternativeEvent("alt-1", 18 * 60 + 15, 19 * 60 + 15, "AI builders meetup")],
    });

    const pdf = await renderSideEventRecommendationPdf(result);

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2200);
    expect(countPages(pdf)).toBeLessThanOrEqual(2);

    const crowdedPdf = await renderSideEventRecommendationPdf(
      recommendationResult({
        route: Array.from({ length: 16 }, (_, index) =>
          routeEvent(
            `crowded-route-${index}`,
            9 * 60 + index * 45,
            9 * 60 + index * 45 + 30,
            `Priority route event ${index} with a long title that should be clipped cleanly`,
          ),
        ),
        alternatives: Array.from({ length: 8 }, (_, index) =>
          alternativeEvent(
            `crowded-alt-${index}`,
            18 * 60 + index * 10,
            19 * 60 + index * 10,
            `Alternative event ${index}`,
          ),
        ),
      }),
    );

    expect(crowdedPdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(countPages(crowdedPdf)).toBeLessThanOrEqual(2);
  });
});

function recommendationResult(
  overrides: Pick<SideEventRecommendationResult, "route" | "alternatives">,
): SideEventRecommendationResult {
  return {
    requestSummary: {
      mode: "diagnostic",
      locale: "en",
      topics: ["stablecoin", "rwa"],
      role: "investor",
      goals: ["partnerships"],
      days: ["2026-07-13"],
      language: "both",
      density: "balanced",
      generatedAt: "2026-07-01T00:00:00.000Z",
    },
    sideEventsUpdatedAt: "2026-07-01T00:00:00.000Z",
    model: { name: "local", source: "local-fallback", latencyMs: 3 },
    profileTags: ["stablecoin", "rwa"],
    summary: "A readable side-event route summary.",
    route: overrides.route,
    recommendations: overrides.route,
    alternatives: overrides.alternatives,
    notes: ["Confirm approval and ticket requirements on Luma before attending."],
  };
}

function routeEvent(id: string, startMinutes: number, endMinutes: number, title: string): RouteEvent {
  return {
    id,
    title,
    url: `https://luma.com/${id}`,
    sourceUrl: "https://luma.com/webx.sideevents",
    date: "2026-07-13",
    dayLabel: "7/13",
    startDateTime: "2026-07-13T09:00:00.000Z",
    endDateTime: "2026-07-13T10:00:00.000Z",
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(endMinutes),
    startMinutes,
    endMinutes,
    venueName: "Venue A",
    address: "Tokyo",
    venueKey: "venue-a",
    description: title,
    organizers: ["Example DAO"],
    images: ["https://example.com/event.png"],
    offers: [],
    registration: {
      approvalRequired: true,
      registrationRequired: true,
      free: true,
    },
    language: "EN",
    tags: ["stablecoin", "networking"],
    rawText: title,
    isOfficial: false,
    score: 88,
    reason: "Matches investor networking goals.",
    note: "Approval may be required.",
    matchedThemes: ["stablecoin"],
  };
}

function alternativeEvent(id: string, startMinutes: number, endMinutes: number, title: string): AlternativeEvent {
  const { moveFromPrevious: _moveFromPrevious, ...event } = routeEvent(id, startMinutes, endMinutes, title);
  return {
    ...event,
    conflictWith: "Stablecoin investor dinner",
  };
}

function minutesToTime(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function countPages(pdf: Buffer): number {
  return pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}
