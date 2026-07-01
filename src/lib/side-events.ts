import { readFileSync } from "node:fs";
import path from "node:path";
import { SideEventData, sideEventDataSchema } from "./types";

let cachedSideEvents: SideEventData | null = null;

export function getSideEvents(): SideEventData {
  if (cachedSideEvents) {
    return cachedSideEvents;
  }

  const sideEventsPath = path.join(process.cwd(), "data", "side-events.json");
  const raw = readFileSync(sideEventsPath, "utf8");
  cachedSideEvents = sideEventDataSchema.parse(JSON.parse(raw));
  return cachedSideEvents;
}

export function resetSideEventsCacheForTests(): void {
  cachedSideEvents = null;
}
