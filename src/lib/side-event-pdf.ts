import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import { getPdfFontCandidates } from "./pdf";
import { SideEventRecommendationResult } from "./types";

type TableEvent = SideEventRecommendationResult["route"][number] | SideEventRecommendationResult["alternatives"][number];
type Locale = SideEventRecommendationResult["requestSummary"]["locale"];

const COLORS = {
  ink: "#121417",
  muted: "#667085",
  line: "#d9dee5",
  surfaceSoft: "#f5f7fa",
  accent: "#2563eb",
};

const PAGE = {
  margin: 36,
  footerHeight: 28,
  maxPages: 2,
};

const TABLE = {
  headerHeight: 18,
  routeRowHeight: 42,
  alternativeRowHeight: 38,
};

const PDF_COPY = {
  ja: {
    documentTitle: "WebX 2026 おすすめサイドイベントルート",
    heading: "WebX 2026 Side Events",
    defaultSummary: "参加目的に合わせたWebX 2026サイドイベントのおすすめルートです。",
    route: "サイドイベントルート",
    alternatives: "代替候補",
    emptyRoute: "現在の条件ではサイドイベントルートを生成できませんでした。",
    continued: "続き",
    omitted: "紙面の都合により、一部の代替候補を省略しています。",
    info: {
      days: "参加日",
      language: "言語",
      density: "回り方",
      generatedAt: "生成",
      sideEventsUpdatedAt: "Luma更新",
      model: "評価",
    },
    table: {
      time: "時間",
      venue: "会場",
      event: "イベント",
      note: "メモ",
    },
    routeCount: (count: number) => `${count}件`,
  },
  en: {
    documentTitle: "WebX 2026 Recommended Side-Event Route",
    heading: "WebX 2026 Side Events",
    defaultSummary: "A recommended WebX 2026 side-event route based on the participant goal.",
    route: "Route",
    alternatives: "Alternatives",
    emptyRoute: "No side-event route could be generated with the current conditions.",
    continued: "continued",
    omitted: "Some alternatives are omitted to keep the PDF within two pages.",
    info: {
      days: "Days",
      language: "Language",
      density: "Density",
      generatedAt: "Generated",
      sideEventsUpdatedAt: "Luma updated",
      model: "Scoring",
    },
    table: {
      time: "Time",
      venue: "Venue",
      event: "Event",
      note: "Note",
    },
    routeCount: (count: number) => `${count} event${count === 1 ? "" : "s"}`,
  },
} as const;

type RenderState = {
  pageCount: number;
  locale: Locale;
  copy: typeof PDF_COPY[Locale];
  sideEventsUpdatedAt: string;
};

export async function renderSideEventRecommendationPdf(result: SideEventRecommendationResult): Promise<Buffer> {
  const locale = result.requestSummary.locale === "en" ? "en" : "ja";
  const copy = PDF_COPY[locale];
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE.margin,
    bufferPages: true,
    compress: false,
    info: { Title: copy.documentTitle },
  });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const ended = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  applyPdfFont(doc, locale);

  const state: RenderState = {
    pageCount: 1,
    locale,
    copy,
    sideEventsUpdatedAt: result.sideEventsUpdatedAt,
  };

  drawHeader(doc, result, state);
  drawInfo(doc, result, state);

  if (result.route.length === 0) {
    drawSectionTitle(doc, copy.route);
    drawEmptyMessage(doc, copy.emptyRoute);
  } else {
    drawEventTable(doc, state, copy.route, result.route, TABLE.routeRowHeight, true);
  }

  const omittedAlternatives = drawEventTable(
    doc,
    state,
    copy.alternatives,
    result.alternatives.slice(0, 8),
    TABLE.alternativeRowHeight,
    false,
  );

  drawShortNote(doc, state, omittedAlternatives > 0 ? copy.omitted : result.notes.slice(0, 1).join(" "));
  drawFooter(doc, state);

  doc.end();
  return ended;
}

function drawHeader(doc: PDFKit.PDFDocument, result: SideEventRecommendationResult, state: RenderState): void {
  const { copy } = state;
  const x = doc.page.margins.left;
  const width = contentWidth(doc);

  doc.fillColor(COLORS.ink).fontSize(18).text(copy.heading, x, doc.y, { width: width - 90 });
  doc.fillColor(COLORS.muted).fontSize(9).text(copy.routeCount(result.route.length), x + width - 86, doc.y - 18, {
    width: 86,
    align: "right",
  });

  doc.moveDown(0.35);
  doc.fillColor(COLORS.muted).fontSize(8.4).text(clipText(result.summary || copy.defaultSummary, 160), x, doc.y, {
    width,
    height: 24,
    lineGap: 1,
    ellipsis: true,
  });
  doc.y += 7;
}

function drawInfo(doc: PDFKit.PDFDocument, result: SideEventRecommendationResult, state: RenderState): void {
  const { copy, locale } = state;
  const x = doc.page.margins.left;
  const width = contentWidth(doc);
  const top = doc.y;
  const left = [
    `${copy.info.days}: ${result.requestSummary.days.map((day) => formatDay(day, locale)).join(" / ")}`,
    `${copy.info.language}: ${formatLanguage(result.requestSummary.language, locale)}`,
    `${copy.info.density}: ${formatDensity(result.requestSummary.density, locale)}`,
  ].join("   ");
  const right = [
    `${copy.info.generatedAt}: ${formatDateTime(result.requestSummary.generatedAt, locale)}`,
    `${copy.info.model}: ${formatModelSource(result.model.source, locale)}`,
  ].join("   ");

  doc.save().rect(x, top, width, 34).fill(COLORS.surfaceSoft).restore();
  doc.fillColor(COLORS.ink).fontSize(8.2).text(left, x + 8, top + 7, {
    width: width - 16,
    height: 10,
    ellipsis: true,
  });
  doc.fillColor(COLORS.muted).fontSize(7.8).text(right, x + 8, top + 20, {
    width: width - 16,
    height: 10,
    ellipsis: true,
  });
  doc.y = top + 44;
}

function drawEventTable(
  doc: PDFKit.PDFDocument,
  state: RenderState,
  title: string,
  events: TableEvent[],
  rowHeight: number,
  required: boolean,
): number {
  if (events.length === 0) {
    return 0;
  }

  if (!ensureSpace(doc, state, 30 + TABLE.headerHeight + rowHeight, required)) {
    return events.length;
  }

  drawSectionTitle(doc, title);
  drawTableHeader(doc, state);

  let omitted = 0;
  events.forEach((event, index) => {
    if (!ensureSpace(doc, state, rowHeight, required)) {
      omitted += 1;
      return;
    }
    drawEventRow(doc, state, event, index, rowHeight);
  });

  doc.y += 8;
  return omitted;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  const x = doc.page.margins.left;
  const width = contentWidth(doc);
  doc.fillColor(COLORS.ink).fontSize(11.5).text(title, x, doc.y, { width });
  doc.moveTo(x, doc.y + 4).lineTo(x + width, doc.y + 4).strokeColor(COLORS.line).lineWidth(0.7).stroke();
  doc.y += 12;
}

function drawTableHeader(doc: PDFKit.PDFDocument, state: RenderState): void {
  const { copy } = state;
  const columns = tableColumns(doc);
  const x = doc.page.margins.left;
  const y = doc.y;
  const width = contentWidth(doc);

  doc.save().rect(x, y, width, TABLE.headerHeight).fill(COLORS.surfaceSoft).restore();
  doc.fillColor(COLORS.muted).fontSize(7.4);
  doc.text(copy.table.time, columns.time.x, y + 5, { width: columns.time.width });
  doc.text(copy.table.venue, columns.venue.x, y + 5, { width: columns.venue.width });
  doc.text(copy.table.event, columns.event.x, y + 5, { width: columns.event.width });
  doc.text(copy.table.note, columns.note.x, y + 5, { width: columns.note.width });
  doc.y = y + TABLE.headerHeight;
}

function drawEventRow(
  doc: PDFKit.PDFDocument,
  state: RenderState,
  event: TableEvent,
  index: number,
  rowHeight: number,
): void {
  const columns = tableColumns(doc);
  const x = doc.page.margins.left;
  const y = doc.y;
  const width = contentWidth(doc);

  if (index % 2 === 1) {
    doc.save().rect(x, y, width, rowHeight).fill("#fafafa").restore();
  }

  doc.save().rect(x, y, 3, rowHeight).fill(COLORS.accent).restore();
  doc.moveTo(x, y + rowHeight).lineTo(x + width, y + rowHeight).strokeColor(COLORS.line).lineWidth(0.45).stroke();

  doc.fillColor(COLORS.ink).fontSize(7.6).text(`${event.dayLabel}\n${event.startTime}`, columns.time.x, y + 7, {
    width: columns.time.width,
    height: rowHeight - 10,
    lineGap: 1,
    ellipsis: true,
  });
  doc.fillColor(COLORS.muted).fontSize(7.2).text(clipText(event.venueName, 58), columns.venue.x, y + 7, {
    width: columns.venue.width,
    height: rowHeight - 10,
    ellipsis: true,
  });
  doc.fillColor(COLORS.ink).fontSize(8.2).text(clipText(event.title, 105), columns.event.x, y + 6, {
    width: columns.event.width,
    height: rowHeight - 10,
    lineGap: 1,
    ellipsis: true,
  });
  doc.fillColor(COLORS.muted).fontSize(7.3).text(clipText(event.note || event.reason, 90), columns.note.x, y + 7, {
    width: columns.note.width,
    height: rowHeight - 10,
    lineGap: 1,
    ellipsis: true,
  });

  doc.y = y + rowHeight;
}

function drawEmptyMessage(doc: PDFKit.PDFDocument, message: string): void {
  const x = doc.page.margins.left;
  const width = contentWidth(doc);
  doc.fillColor(COLORS.muted).fontSize(9).text(message, x, doc.y, { width });
  doc.y += 18;
}

function drawShortNote(doc: PDFKit.PDFDocument, state: RenderState, note: string): void {
  if (!note || !ensureSpace(doc, state, 26, false)) {
    return;
  }
  const x = doc.page.margins.left;
  const width = contentWidth(doc);
  doc.fillColor(COLORS.muted).fontSize(7.8).text(clipText(note, 180), x, doc.y, {
    width,
    height: 18,
    ellipsis: true,
  });
  doc.y += 18;
}

function ensureSpace(doc: PDFKit.PDFDocument, state: RenderState, height: number, allowPageBreak: boolean): boolean {
  if (doc.y + height <= contentBottom(doc)) {
    return true;
  }
  if (!allowPageBreak && state.pageCount >= PAGE.maxPages) {
    return false;
  }
  if (state.pageCount >= PAGE.maxPages) {
    return false;
  }

  doc.addPage();
  state.pageCount += 1;
  doc.y = PAGE.margin;
  doc.fillColor(COLORS.muted).fontSize(8).text(`${state.copy.heading} - ${state.copy.continued}`, doc.page.margins.left, doc.y, {
    width: contentWidth(doc),
  });
  doc.y += 18;
  return true;
}

function drawFooter(doc: PDFKit.PDFDocument, state: RenderState): void {
  const range = doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const x = doc.page.margins.left;
    const y = doc.page.height - doc.page.margins.bottom - 14;
    const width = contentWidth(doc);
    doc.moveTo(x, y - 7).lineTo(x + width, y - 7).strokeColor(COLORS.line).lineWidth(0.5).stroke();
    doc.fillColor(COLORS.muted).fontSize(7).text(
      `${state.copy.info.sideEventsUpdatedAt}: ${formatDateTime(state.sideEventsUpdatedAt, state.locale)}`,
      x,
      y,
      { width: width * 0.72, ellipsis: true },
    );
    doc.text(`${pageIndex + 1} / ${range.count}`, x + width * 0.72, y, { width: width * 0.28, align: "right" });
  }
}

function tableColumns(doc: PDFKit.PDFDocument) {
  const x = doc.page.margins.left;
  return {
    time: { x: x + 8, width: 64 },
    venue: { x: x + 78, width: 116 },
    event: { x: x + 202, width: 206 },
    note: { x: x + 416, width: contentWidth(doc) - 424 },
  };
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function contentBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom - PAGE.footerHeight;
}

function clipText(value: string, maxCharacters: number): string {
  const chars = Array.from(value.replace(/\s+/g, " ").trim());
  if (chars.length <= maxCharacters) {
    return chars.join("");
  }
  return `${chars.slice(0, maxCharacters - 1).join("")}...`;
}

function applyPdfFont(doc: PDFKit.PDFDocument, locale: Locale): void {
  const failures: string[] = [];

  for (const candidate of getPdfFontCandidates()) {
    if (!existsSync(candidate.path)) {
      continue;
    }
    try {
      doc.registerFont("AppFont", candidate.path, candidate.postscriptName);
      doc.font("AppFont");
      return;
    } catch (error) {
      const label = candidate.postscriptName ? `${candidate.path}#${candidate.postscriptName}` : candidate.path;
      failures.push(label);
      console.warn(`Failed to use PDF font ${label}.`, error);
    }
  }

  if (locale === "ja") {
    const tried = failures.length > 0 ? ` Tried but failed: ${failures.join(", ")}.` : "";
    throw new Error(`No usable Japanese PDF font was found. Install a CJK font or set PDF_FONT_PATH/PDF_FONT_POSTSCRIPT_NAME.${tried}`);
  }

  doc.font("Helvetica");
}

function formatDateTime(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(locale === "en" ? "en-US" : "ja-JP", {
    timeZone: "Asia/Tokyo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDay(value: string, locale: Locale): string {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLanguage(value: string, locale: Locale): string {
  if (value === "both") {
    return "JA / EN";
  }
  if (value === "ja") {
    return locale === "en" ? "Japanese" : "日本語";
  }
  if (value === "en") {
    return locale === "en" ? "English" : "英語";
  }
  return value;
}

function formatDensity(value: string, locale: Locale): string {
  if (value === "balanced") {
    return locale === "en" ? "Balanced" : "バランス型";
  }
  if (value === "relaxed") {
    return locale === "en" ? "Relaxed" : "ゆったり型";
  }
  if (value === "packed") {
    return locale === "en" ? "Packed" : "詰め込み型";
  }
  return value;
}

function formatModelSource(value: string, locale: Locale): string {
  if (value === "gemini") {
    return "Gemini";
  }
  if (value === "local-fallback") {
    return locale === "en" ? "Local scoring" : "ローカル評価";
  }
  return value;
}
