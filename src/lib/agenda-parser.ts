import * as cheerio from "cheerio";
import { STAGES, WEBX_AGENDA_URL } from "./constants";
import { AgendaData, AgendaSession, agendaDataSchema } from "./types";

const headerPattern = new RegExp(
  `^7\\/(13|14)(?:\\s+(JA|EN))?\\s+(${STAGES.map(escapeRegExp).join("|")})$`,
);

const timePattern = /^(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)$/i;

const ignoredContent = new Set([
  "Image",
  "×",
  "x",
  "EN /",
  "JA",
]);

const categoryHints = new Set([
  "Fireside Chat",
  "Special Keynote",
  "Special Session",
  "Keynote",
  "OPENING",
]);

const stageAliases = new Map<string, AgendaSession["stage"]>([
  ["CRYL ステージ", "CRYL Stage"],
  ["Binance ステージ", "Binance Stage"],
  ["C ステージ", "C Stage"],
  ["Visionary ステージ", "Visionary Stage"],
  ["セミナー", "Seminar"],
  ["金融セミナー", "Seminar"],
]);

export function parseAgendaHtml(html: string, fetchedAt = new Date().toISOString()): AgendaData {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const domAgenda = parseAgendaDom($, fetchedAt);
  if (domAgenda.sessions.length > 0) {
    return domAgenda;
  }

  const lines = normalizeBodyText($("body").text());
  const sessions: AgendaSession[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const header = parseHeader(lines[index]);
    if (!header) {
      continue;
    }

    const timeLine = lines[index + 1];
    const time = parseTimeRange(timeLine);
    if (!time) {
      continue;
    }

    const content: string[] = [];
    let cursor = index + 2;
    while (cursor < lines.length && !parseHeader(lines[cursor])) {
      if (shouldStop(lines[cursor])) {
        cursor = lines.length;
        break;
      }
      content.push(lines[cursor]);
      cursor += 1;
    }

    const details = normalizeSessionDetails(content);
    const id = buildSessionId(header.day, header.stage, time.startMinutes, sessions.length + 1);

    sessions.push({
      id,
      date: header.day === "13" ? "2026-07-13" : "2026-07-14",
      dayLabel: `7/${header.day}`,
      language: header.language ?? "UNKNOWN",
      stage: header.stage,
      startTime: time.startLabel,
      endTime: time.endLabel,
      startMinutes: time.startMinutes,
      endMinutes: time.endMinutes,
      title: details.title,
      speakers: details.speakers,
      categories: details.categories,
      rawText: details.rawText,
      isPlaceholder: details.isPlaceholder,
    });

    index = cursor - 1;
  }

  const agenda = {
    event: "WebX 2026" as const,
    sourceUrl: WEBX_AGENDA_URL,
    lastUpdated: fetchedAt,
    stages: [...STAGES],
    sessions: sessions.sort((a, b) =>
      a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes || a.stage.localeCompare(b.stage),
    ),
  };

  return agendaDataSchema.parse(agenda);
}

function parseAgendaDom($: cheerio.CheerioAPI, fetchedAt: string): AgendaData {
  const sessions: AgendaSession[] = [];

  $(".ag-set").each((index, element) => {
    const root = $(element);
    const dayText = clean(root.find(".ag-date").first().text());
    const day = dayText.match(/^7\/(13|14)$/)?.[1] as "13" | "14" | undefined;
    const stageText = clean(root.find(".ag-room").first().text());
    const stage = normalizeStage(stageText);
    const time = parseTimeRange(clean(root.find(".ag-time").first().text()));

    if (!day || !stage || !time) {
      return;
    }

    const languageText = clean(root.find(".ag-lang").first().text());
    const language = languageText === "JA" || languageText === "EN" ? languageText : "UNKNOWN";
    const titleText = clean(root.find(".ag-title").first().text());
    const categories = root.find(".ag-label")
      .map((_, label) => clean($(label).text()))
      .get()
      .filter(Boolean);
    const speakers = root.find(".ag-spaker, .ag-speaker")
      .map((_, speaker) => {
        const node = $(speaker);
        const name = clean(node.find(".ag-spaker-name, .ag-speaker-name").first().text());
        const company = clean(node.find(".ag-spaker-com, .ag-speaker-com").first().text());
        const position = clean(node.find(".ag-spaker-pos, .ag-speaker-pos").first().text());
        return [name, company, position].filter(Boolean).join(" / ");
      })
      .get()
      .filter((speaker) => speaker && !isPlaceholderText(speaker))
      .slice(0, 12);

    const isPlaceholder = !titleText || isPlaceholderText(titleText);
    const htmlId = root.attr("id");

    sessions.push({
      id: htmlId ? `webx-2026-${htmlId}` : buildSessionId(day, stage, time.startMinutes, index + 1),
      date: day === "13" ? "2026-07-13" : "2026-07-14",
      dayLabel: `7/${day}`,
      language,
      stage,
      startTime: time.startLabel,
      endTime: time.endLabel,
      startMinutes: time.startMinutes,
      endMinutes: time.endMinutes,
      title: isPlaceholder ? "詳細未公開" : titleText,
      speakers,
      categories,
      rawText: [titleText, ...categories, ...speakers].filter(Boolean).join(" ") || "COMING SOON",
      isPlaceholder,
    });
  });

  const agenda = {
    event: "WebX 2026" as const,
    sourceUrl: WEBX_AGENDA_URL,
    lastUpdated: fetchedAt,
    stages: [...STAGES],
    sessions: sessions.sort((a, b) =>
      a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes || a.stage.localeCompare(b.stage),
    ),
  };

  return agendaDataSchema.parse(agenda);
}

function normalizeBodyText(text: string): string[] {
  let normalized = text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const stage of STAGES) {
    const header = new RegExp(`(7\\/(?:13|14)(?:\\s+(?:JA|EN))?\\s+${escapeRegExp(stage)})`, "g");
    normalized = normalized.replace(header, "\n$1\n");
  }

  normalized = normalized.replace(
    /(\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))/gi,
    "\n$1\n",
  );

  return normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseHeader(line: string) {
  const match = line.match(headerPattern);
  if (!match) {
    return null;
  }

  return {
    day: match[1] as "13" | "14",
    language: (match[2] as "JA" | "EN" | undefined) ?? undefined,
    stage: match[3] as AgendaSession["stage"],
  };
}

function normalizeStage(value: string): AgendaSession["stage"] | undefined {
  return STAGES.find((candidate) => candidate === value) ?? stageAliases.get(value);
}

function parseTimeRange(line: string | undefined) {
  if (!line) {
    return null;
  }

  const match = line.match(timePattern);
  if (!match) {
    return null;
  }

  const startLabel = `${match[1]} ${match[2].toUpperCase()}`;
  const endLabel = `${match[3]} ${match[4].toUpperCase()}`;
  return {
    startLabel,
    endLabel,
    startMinutes: clockToMinutes(match[1], match[2]),
    endMinutes: clockToMinutes(match[3], match[4]),
  };
}

function clean(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function clockToMinutes(clock: string, meridiem: string): number {
  const [rawHour, rawMinute] = clock.split(":").map(Number);
  let hour = rawHour % 12;
  if (meridiem.toUpperCase() === "PM") {
    hour += 12;
  }
  return hour * 60 + rawMinute;
}

function normalizeSessionDetails(content: string[]) {
  const cleaned = content
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !ignoredContent.has(line));

  const meaningful = cleaned.filter((line) => !/^(Image|×|x)$/i.test(line));
  const nonPlaceholder = meaningful.filter((line) => !isPlaceholderText(line));
  const isPlaceholder = nonPlaceholder.length === 0;
  const title = isPlaceholder ? "詳細未公開" : chooseTitle(nonPlaceholder);
  const categories = nonPlaceholder
    .filter((line) => line !== title)
    .filter((line) => categoryHints.has(line) || (line.length <= 24 && !line.includes(" ")));
  const speakers = nonPlaceholder
    .filter((line) => line !== title)
    .filter((line) => !categories.includes(line))
    .slice(0, 8);

  return {
    title,
    categories,
    speakers,
    isPlaceholder,
    rawText: meaningful.join(" ").trim() || "COMING SOON",
  };
}

function chooseTitle(lines: string[]): string {
  const titleCandidates = lines.filter((line) => !categoryHints.has(line));
  const candidates = titleCandidates.length > 0 ? titleCandidates : lines;
  return candidates.reduce((best, line) => (line.length > best.length ? line : best), candidates[0]);
}

function isPlaceholderText(line: string): boolean {
  return /^(COMING SOON|TBA|To be announced)$/i.test(line.trim());
}

function shouldStop(line: string): boolean {
  return /^(SUBSCRIBE|What’s WebX|Sponsors of|Why Japan|©)/i.test(line);
}

function buildSessionId(day: "13" | "14", stage: string, startMinutes: number, sequence: number): string {
  const stageSlug = stage.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `webx-2026-07${day}-${stageSlug}-${String(startMinutes).padStart(4, "0")}-${sequence}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
