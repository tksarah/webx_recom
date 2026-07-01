import { afterEach, describe, expect, it } from "vitest";
import { recommendSideEvents } from "./side-event-recommendation";
import {
  buildOptimizedSideEventRoute,
  canAttendSideEventAfter,
  createSideEventRecommendationItems,
} from "./side-event-scheduler";
import type { SideEvent, SideEventData, SideEventGeminiRecommendation, SideEventRecommendRequest } from "./types";

const originalDisableGemini = process.env.DISABLE_GEMINI;

afterEach(() => {
  if (originalDisableGemini === undefined) {
    delete process.env.DISABLE_GEMINI;
  } else {
    process.env.DISABLE_GEMINI = originalDisableGemini;
  }
});

describe("side-event scheduler", () => {
  it("requires a 45-minute buffer between different venues", () => {
    const a = event("a", "venue-a", 18 * 60, 19 * 60, "A");
    const b = event("b", "venue-b", 19 * 60 + 30, 21 * 60, "B");
    const c = event("c", "venue-b", 19 * 60 + 45, 21 * 60, "C");
    const d = event("d", "venue-a", 19 * 60, 21 * 60, "D");

    expect(canAttendSideEventAfter(a, b)).toBe(false);
    expect(canAttendSideEventAfter(a, c)).toBe(true);
    expect(canAttendSideEventAfter(a, d)).toBe(true);
  });

  it("builds a packed route with at most three events per day", () => {
    const events = [
      event("a", "venue-a", 10 * 60, 11 * 60, "High A"),
      event("b", "venue-b", 11 * 60 + 45, 12 * 60 + 45, "High B"),
      event("c", "venue-c", 13 * 60 + 30, 14 * 60 + 30, "High C"),
      event("d", "venue-d", 15 * 60 + 15, 16 * 60 + 15, "High D"),
    ];
    const ai: SideEventGeminiRecommendation = {
      profileTags: ["ai"],
      summary: "test",
      eventScores: events.map((item, index) => ({
        eventId: item.id,
        score: 90 - index,
        reason: item.title,
        note: "",
        matchedThemes: ["ai"],
      })),
    };
    const items = createSideEventRecommendationItems(events, ai, request("packed"));
    const route = buildOptimizedSideEventRoute(items, "packed");

    expect(route).toHaveLength(3);
    expect(route.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(route[1].moveFromPrevious).toMatchObject({ fromVenue: "Venue A", minutes: 45 });
  });

  it("falls back to local scoring when Gemini is disabled", async () => {
    process.env.DISABLE_GEMINI = "1";
    const sideEvents: SideEventData = {
      event: "WebX 2026 Side Events",
      sourceUrl: "https://luma.com/webx.sideevents",
      lastUpdated: "2026-07-01T00:00:00.000Z",
      events: [
        event("stablecoin", "venue-a", 18 * 60, 20 * 60, "Stablecoin investor dinner", ["stablecoin", "investment"]),
        event("security", "venue-b", 18 * 60, 20 * 60, "Wallet security meetup", ["security"]),
      ],
    };

    const result = await recommendSideEvents(request("balanced"), sideEvents);

    expect(result.model.source).toBe("local-fallback");
    expect(result.route[0].id).toBe("stablecoin");
    expect(result.route[0].reason).toContain("Stablecoins");
  });
});

function request(density: SideEventRecommendRequest["basics"]["density"]): SideEventRecommendRequest {
  return {
    mode: "diagnostic",
    locale: "en",
    basics: {
      days: ["2026-07-13"],
      language: "both",
      density,
    },
    diagnostic: {
      topics: ["stablecoin", "investment"],
      role: "investor",
      goals: ["partnerships"],
    },
  };
}

function event(
  id: string,
  venueKey: string,
  startMinutes: number,
  endMinutes: number,
  title: string,
  tags: string[] = ["ai"],
): SideEvent {
  const venueSuffix = venueKey.split("-").pop()?.toUpperCase() ?? "A";
  return {
    id,
    title,
    url: `https://luma.com/${id}`,
    sourceUrl: "https://luma.com/webx.sideevents",
    date: "2026-07-13",
    dayLabel: "7/13",
    startDateTime: "2026-07-13T09:00:00.000Z",
    endDateTime: "2026-07-13T11:00:00.000Z",
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(endMinutes),
    startMinutes,
    endMinutes,
    venueName: `Venue ${venueSuffix}`,
    address: "Tokyo",
    venueKey,
    description: title,
    organizers: ["Host"],
    images: [],
    offers: [],
    registration: {
      approvalRequired: false,
      registrationRequired: true,
      free: false,
    },
    language: "EN",
    tags,
    rawText: `${title} ${tags.join(" ")}`,
    isOfficial: false,
  };
}

function minutesToTime(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
