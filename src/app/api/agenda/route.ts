import { NextResponse } from "next/server";
import { getAgenda } from "@/lib/agenda";

export const runtime = "nodejs";

export async function GET() {
  const agenda = getAgenda();
  return NextResponse.json({
    event: agenda.event,
    sourceUrl: agenda.sourceUrl,
    lastUpdated: agenda.lastUpdated,
    stages: agenda.stages,
    sessionCount: agenda.sessions.length,
    sessions: agenda.sessions,
  });
}
