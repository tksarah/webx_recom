import { NextResponse } from "next/server";
import { getSideEvents } from "@/lib/side-events";

export const runtime = "nodejs";

export async function GET() {
  const sideEvents = getSideEvents();
  const availableDays = Array.from(
    sideEvents.events.reduce((days, event) => {
      days.set(event.date, (days.get(event.date) ?? 0) + 1);
      return days;
    }, new Map<string, number>()),
  )
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    event: sideEvents.event,
    sourceUrl: sideEvents.sourceUrl,
    lastUpdated: sideEvents.lastUpdated,
    eventCount: sideEvents.events.length,
    availableDays,
    events: sideEvents.events,
  });
}
