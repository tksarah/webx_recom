import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LUMA_SIDE_EVENTS_URL } from "../src/lib/constants";
import {
  buildSideEventData,
  mergeParsedSideEvent,
  parseLumaCalendarEvents,
  parseSideEventDetailHtml,
  type ParsedLumaSideEvent,
} from "../src/lib/side-events-parser";

const CONCURRENCY = 4;

async function main() {
  const fetchedAt = new Date().toISOString();
  const calendarHtml = await fetchText(LUMA_SIDE_EVENTS_URL);
  const calendarEvents = parseLumaCalendarEvents(calendarHtml);

  if (calendarEvents.length < 1) {
    throw new Error("Luma calendar parse produced no side events.");
  }

  const detailByUrl = new Map<string, ParsedLumaSideEvent | null>();
  await mapWithConcurrency(calendarEvents, CONCURRENCY, async (event) => {
    try {
      const detailHtml = await fetchText(event.url);
      detailByUrl.set(event.url, parseSideEventDetailHtml(detailHtml));
    } catch (error) {
      console.warn(`Failed to fetch side event details for ${event.url}; keeping calendar data only.`, error);
      detailByUrl.set(event.url, null);
    }
  });

  const mergedEvents = calendarEvents.map((event) => mergeParsedSideEvent(event, detailByUrl.get(event.url)));
  const sideEvents = buildSideEventData(mergedEvents, fetchedAt, LUMA_SIDE_EVENTS_URL);

  const outputDirectory = path.join(process.cwd(), "data");
  const outputPath = path.join(outputDirectory, "side-events.json");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(sideEvents, null, 2)}\n`, "utf8");

  console.log(`Wrote ${sideEvents.events.length} side events to ${outputPath}`);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "webx-2026-session-recommender/0.1",
      "Accept-Language": "ja,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index], index);
    }
  });
  await Promise.all(workers);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
