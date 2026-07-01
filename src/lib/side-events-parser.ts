import * as cheerio from "cheerio";
import { LUMA_SIDE_EVENTS_URL } from "./constants";
import { SideEvent, SideEventData, sideEventDataSchema, sideEventSchema } from "./types";

type JsonRecord = Record<string, unknown>;

export type ParsedLumaSideEvent = {
  title: string;
  url: string;
  startDateTime: string;
  endDateTime?: string;
  venueName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  organizers?: string[];
  images?: string[];
  offers?: Array<{
    name?: string;
    price?: number | null;
    currency?: string;
    availability?: string;
  }>;
  approvalRequired?: boolean;
  registrationRequired?: boolean;
  free?: boolean;
  pageText?: string;
};

const topicKeywords: Record<string, string[]> = {
  stablecoin: ["stablecoin", "stablecoins", "ステーブルコイン", "決済", "payment", "payments"],
  rwa: ["rwa", "tokenization", "tokenized", "トークン化", "real-world asset", "treasury"],
  ai: ["ai", "agent", "agentic", "auton", "autonomous", "人工知能"],
  regulation: ["regulation", "regulatory", "compliance", "policy", "規制", "コンプライアンス"],
  bitcoin: ["bitcoin", "btc", "ビットコイン"],
  defi: ["defi", "liquidity", "onchain", "on-chain", "decentralized finance"],
  security: ["security", "wallet", "custody", "mpc", "fraud", "セキュリティ", "カストディ"],
  enterprise: ["enterprise", "institutional", "corporate", "executive", "leadership", "企業", "機関投資家"],
  payments: ["payment", "payments", "remittance", "wallet", "決済", "送金"],
  infrastructure: ["infrastructure", "protocol", "chain", "layer", "wallet", "blockchain", "インフラ"],
  investment: ["vc", "venture", "capital", "investor", "investment", "market maker", "otc", "投資"],
  policy: ["government", "policy", "public", "regulatory", "digital economy", "政策"],
};

export function parseSideEventsCalendarHtml(html: string, fetchedAt = new Date().toISOString()): SideEventData {
  const calendarEvents = parseLumaCalendarEvents(html);
  return buildSideEventData(calendarEvents, fetchedAt);
}

export function parseLumaCalendarEvents(html: string): ParsedLumaSideEvent[] {
  return extractJsonLd(html)
    .flatMap(findEventRecords)
    .map(parseEventRecord)
    .filter((event): event is ParsedLumaSideEvent => Boolean(event));
}

export function parseSideEventDetailHtml(html: string): ParsedLumaSideEvent | null {
  const event = extractJsonLd(html)
    .flatMap(findEventRecords)
    .map(parseEventRecord)
    .find((candidate): candidate is ParsedLumaSideEvent => Boolean(candidate));

  if (!event) {
    return null;
  }

  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  const pageText = clean($("body").text());
  const free = event.free ?? /\bfree\b|無料/i.test(pageText);

  return {
    ...event,
    approvalRequired: event.approvalRequired ?? /approval required|host approval|事前承認|承認制/i.test(pageText),
    registrationRequired: event.registrationRequired ?? /registration|required|register|request to join|登録|申し込み/i.test(pageText),
    free,
    pageText,
  };
}

export function mergeParsedSideEvent(
  calendarEvent: ParsedLumaSideEvent,
  detailEvent?: ParsedLumaSideEvent | null,
): ParsedLumaSideEvent {
  if (!detailEvent) {
    return calendarEvent;
  }

  return {
    ...calendarEvent,
    ...detailEvent,
    title: detailEvent.title || calendarEvent.title,
    url: detailEvent.url || calendarEvent.url,
    startDateTime: detailEvent.startDateTime || calendarEvent.startDateTime,
    endDateTime: detailEvent.endDateTime || calendarEvent.endDateTime,
    venueName: detailEvent.venueName || calendarEvent.venueName,
    address: detailEvent.address || calendarEvent.address,
    description: detailEvent.description || calendarEvent.description,
    organizers: mergeUnique([...(calendarEvent.organizers ?? []), ...(detailEvent.organizers ?? [])]),
    images: mergeUnique([...(detailEvent.images ?? []), ...(calendarEvent.images ?? [])]).slice(0, 6),
    offers: detailEvent.offers?.length ? detailEvent.offers : calendarEvent.offers,
    approvalRequired: detailEvent.approvalRequired ?? calendarEvent.approvalRequired,
    registrationRequired: detailEvent.registrationRequired ?? calendarEvent.registrationRequired,
    free: detailEvent.free ?? calendarEvent.free,
  };
}

export function buildSideEventData(
  events: ParsedLumaSideEvent[],
  fetchedAt = new Date().toISOString(),
  sourceUrl = LUMA_SIDE_EVENTS_URL,
): SideEventData {
  const normalized = events
    .map((event) => normalizeSideEvent(event, sourceUrl))
    .filter((event): event is SideEvent => Boolean(event))
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime) || a.title.localeCompare(b.title));

  return sideEventDataSchema.parse({
    event: "WebX 2026 Side Events",
    sourceUrl,
    lastUpdated: fetchedAt,
    events: normalized,
  });
}

function normalizeSideEvent(event: ParsedLumaSideEvent, sourceUrl: string): SideEvent | null {
  const start = new Date(event.startDateTime);
  if (!event.title || !event.url || Number.isNaN(start.getTime())) {
    return null;
  }

  const end = event.endDateTime ? new Date(event.endDateTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const safeEnd = Number.isNaN(end.getTime()) ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : end;
  const date = formatTokyoDate(start);
  const dayLabel = formatDayLabel(date);
  const venueName = clip(event.venueName || "Venue TBA", 500);
  const address = clip(event.address || "", 500);
  const text = clip([
    event.title,
    event.description,
    event.organizers?.join(" "),
    venueName,
    address,
    event.pageText,
  ].filter(Boolean).join(" "), 8000);
  const offers = (event.offers ?? []).map((offer) => ({
    name: clip(offer.name || "General Admission", 120),
    price: typeof offer.price === "number" ? offer.price : offer.price ?? undefined,
    currency: offer.currency ? clip(offer.currency, 120) : undefined,
    availability: offer.availability ? clip(stripSchemaUrl(offer.availability), 120) : undefined,
  }));
  const free = event.free ?? offers.some((offer) => offer.price === 0);

  return sideEventSchema.parse({
    id: buildSideEventId(event.url),
    title: clip(event.title, 500),
    url: event.url,
    sourceUrl,
    date,
    dayLabel,
    startDateTime: start.toISOString(),
    endDateTime: safeEnd.toISOString(),
    startTime: formatTokyoTime(start),
    endTime: formatTokyoTime(safeEnd),
    startMinutes: minutesInTokyo(start),
    endMinutes: minutesInTokyo(safeEnd),
    venueName,
    address,
    venueKey: buildVenueKey(venueName, address),
    latitude: event.latitude,
    longitude: event.longitude,
    description: clip(event.description || "", 8000),
    organizers: mergeUnique(event.organizers ?? []).map((name) => clip(name, 200)).slice(0, 16),
    images: mergeUnique(event.images ?? []).filter(isUrl).slice(0, 6),
    offers,
    registration: {
      approvalRequired: event.approvalRequired ?? false,
      registrationRequired: event.registrationRequired ?? true,
      free,
    },
    language: inferLanguage(text),
    tags: inferTags(text),
    rawText: text || event.title,
    isOfficial: event.url.includes("webx-asia.com") || /\bby webx\b|official/i.test(text),
  });
}

function extractJsonLd(html: string): unknown[] {
  const $ = cheerio.load(html);
  return $("script[type='application/ld+json']")
    .map((_, element) => {
      const text = $(element).contents().text().trim();
      if (!text) {
        return null;
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    })
    .get()
    .filter((value): value is unknown => value !== null);
}

function findEventRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap(findEventRecords);
  }
  if (!isRecord(value)) {
    return [];
  }

  if (value["@type"] === "Event") {
    return [value];
  }

  if (Array.isArray(value["@graph"])) {
    return value["@graph"].flatMap(findEventRecords);
  }

  if (Array.isArray(value.itemListElement)) {
    return value.itemListElement.flatMap((item) => {
      if (!isRecord(item)) {
        return [];
      }
      return findEventRecords(item.item);
    });
  }

  return [];
}

function parseEventRecord(record: JsonRecord): ParsedLumaSideEvent | null {
  const title = stringValue(record.name);
  const url = stringValue(record.url) || stringValue(record["@id"]);
  const startDateTime = stringValue(record.startDate);
  if (!title || !url || !startDateTime) {
    return null;
  }

  const location = isRecord(record.location) ? record.location : undefined;
  const geo = location && isRecord(location.geo) ? location.geo : undefined;
  const address = location && isRecord(location.address) ? location.address : undefined;
  const offers = parseOffers(record.offers);

  return {
    title,
    url,
    startDateTime,
    endDateTime: stringValue(record.endDate),
    venueName: location ? stringValue(location.name) || formatAddress(address) : undefined,
    address: formatAddress(address),
    latitude: numberValue(geo?.latitude ?? location?.latitude),
    longitude: numberValue(geo?.longitude ?? location?.longitude),
    description: stringValue(record.description),
    organizers: parsePeople(record.organizer),
    images: parseImages(record.image),
    offers,
    free: offers.some((offer) => offer.price === 0),
  };
}

function parseOffers(value: unknown): NonNullable<ParsedLumaSideEvent["offers"]> {
  const records = Array.isArray(value) ? value : value ? [value] : [];
  return records
    .filter(isRecord)
    .map((offer) => ({
      name: stringValue(offer.name),
      price: offer.price === null ? null : numberValue(offer.price),
      currency: stringValue(offer.priceCurrency),
      availability: stringValue(offer.availability),
    }));
}

function parsePeople(value: unknown): string[] {
  const records = Array.isArray(value) ? value : value ? [value] : [];
  return mergeUnique(records
    .map((item) => isRecord(item) ? stringValue(item.name) : undefined)
    .filter((name): name is string => Boolean(name)));
}

function parseImages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && isUrl(item));
  }
  return typeof value === "string" && isUrl(value) ? [value] : [];
}

function formatAddress(address: JsonRecord | undefined): string {
  if (!address) {
    return "";
  }
  return [
    stringValue(address.streetAddress),
    stringValue(address.addressLocality),
    stringValue(address.addressRegion),
    stringValue(address.addressCountry),
  ].filter(Boolean).join(", ");
}

function inferLanguage(text: string): SideEvent["language"] {
  const japaneseCount = (text.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;

  if (japaneseCount > 20 && latinCount > 40) {
    return "BILINGUAL";
  }
  if (japaneseCount > 20) {
    return "JA";
  }
  if (latinCount > 40) {
    return "EN";
  }
  return "UNKNOWN";
}

function inferTags(text: string): string[] {
  const haystack = text.toLowerCase();
  return Object.entries(topicKeywords)
    .filter(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword.toLowerCase())))
    .map(([tag]) => tag)
    .slice(0, 32);
}

function buildSideEventId(url: string): string {
  const parsed = new URL(url);
  const slug = parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname;
  return `side-event-${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function buildVenueKey(venueName: string, address: string): string {
  const source = `${venueName} ${address}`.toLowerCase();
  const normalized = source
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return normalized || "venue-tba";
}

function formatTokyoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

function formatDayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatTokyoTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return `${part(parts, "hour")}:${part(parts, "minute")}`;
}

function minutesInTokyo(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Number(part(parts, "hour")) * 60 + Number(part(parts, "minute"));
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "00";
}

function clean(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function clip(value: string, maxLength: number): string {
  const normalized = clean(value);
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}

function stripSchemaUrl(value: string): string {
  return value.replace(/^https:\/\/schema\.org\//, "");
}

function mergeUnique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
