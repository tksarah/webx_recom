"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  Home,
  Languages,
  Loader2,
  MapPinned,
  Moon,
  Route,
  Sparkles,
  Sun,
  Ticket,
  Users,
} from "lucide-react";
import {
  DENSITY_OPTIONS,
  GOAL_OPTIONS,
  LANGUAGE_OPTIONS,
  LUMA_SIDE_EVENTS_URL,
  ROLE_OPTIONS,
  TOPIC_OPTIONS,
} from "@/lib/constants";
import type { SideEventRecommendationResult } from "@/lib/types";

type Mode = "diagnostic" | "freeText";
type Locale = "ja" | "en";
type Theme = "light" | "dark";
type SelectionMode = "single" | "multi";
type Basics = {
  days: string[];
  language: "both" | "ja" | "en";
  density: "balanced" | "relaxed" | "packed";
};
type SideEventInfo = {
  eventCount: number;
  lastUpdated: string;
  availableDays: Array<{ date: string; count: number }>;
};

type LocalizedChoice = {
  id: string;
  label?: string;
  labelEn?: string;
  display?: string;
  displayEn?: string;
  description?: string;
  descriptionEn?: string;
};

const initialBasics: Basics = {
  days: [],
  language: "both",
  density: "balanced",
};

const UI_COPY = {
  ja: {
    title: "WebX 2026 おすすめサイドイベントルート",
    sourceLoading: "サイドイベント読み込み中",
    eventCount: (count: number) => `${count}件のサイドイベント`,
    updateNote: "Lumaのサイドイベント一覧をもとに、目的に合うイベントと回り方を提案します。",
    updatedAt: (value: string) => `最終更新: ${value}`,
    updatedAtPending: "最終更新: 読み込み中",
    inputPanelAria: "サイドイベント推薦入力",
    resultPanelAria: "サイドイベント推薦結果",
    modeTabsAria: "入力モード",
    diagnostic: "かんたん診断",
    freeText: "自由入力",
    fields: {
      topics: "興味テーマ",
      role: "あなたの立場",
      goals: "参加目的",
      freeTextGoal: "探したいサイドイベント",
      days: "参加日",
      language: "希望言語",
      density: "回り方",
    },
    selectionMode: {
      single: "1つ選択",
      multi: "複数選択可",
    },
    freeTextPlaceholder: "例: ステーブルコインやRWAに関心があり、投資家や事業会社と話せる夜のネットワーキングを探したい",
    generate: "サイドイベントルートを作成",
    recommendError: "サイドイベントルートの作成に失敗しました",
    pdfError: "PDFの生成に失敗しました",
    sessions: "公式セッション",
    source: "Luma一覧",
    localeSwitch: "表示言語",
    emptyTitle: "Luma Side Events",
    emptyVenue: "日付と目的を選んで、会場外の予定を組み立てます",
    localScoring: "ローカル評価",
    routeCount: (count: number) => `${count}件のルート`,
    route: "サイドイベントルート",
    topPicks: "おすすめ上位",
    alternatives: "時間が重なる代替候補",
    pdfDownload: "PDFをダウンロード",
    pdfButton: "PDF",
    themeSwitch: "表示テーマ",
    lightMode: "ライト",
    darkMode: "ダーク",
    score: "スコア",
    organizers: "主催",
    venue: "会場",
    moveNote: (venue: string, minutes: number) => `${venue} から移動 ${minutes}分`,
    conflict: (title: string) => `時間重複: ${title}`,
    eventLink: "Lumaで確認",
    approval: "承認制",
    free: "無料",
    official: "Official",
  },
  en: {
    title: "WebX 2026 Recommended Side-Event Route",
    sourceLoading: "Loading side events",
    eventCount: (count: number) => `${count} side events`,
    updateNote: "Based on the Luma side-event calendar, this page recommends events and a workable route.",
    updatedAt: (value: string) => `Last updated: ${value}`,
    updatedAtPending: "Last updated: loading",
    inputPanelAria: "Side-event recommendation input",
    resultPanelAria: "Side-event recommendation result",
    modeTabsAria: "Input mode",
    diagnostic: "Quick diagnosis",
    freeText: "Free text",
    fields: {
      topics: "Topics",
      role: "Role",
      goals: "Goals",
      freeTextGoal: "Side-event goal",
      days: "Days",
      language: "Preferred language",
      density: "Route density",
    },
    selectionMode: {
      single: "Select one",
      multi: "Select multiple",
    },
    freeTextPlaceholder: "Example: I want evening networking around stablecoins and RWA where I can meet investors and enterprise operators.",
    generate: "Generate side-event route",
    recommendError: "Failed to generate a side-event route",
    pdfError: "Failed to generate PDF",
    sessions: "Main sessions",
    source: "Luma calendar",
    localeSwitch: "Display language",
    emptyTitle: "Luma Side Events",
    emptyVenue: "Pick your days and goals to plan the off-agenda route.",
    localScoring: "Local scoring",
    routeCount: (count: number) => `${count} route stop${count === 1 ? "" : "s"}`,
    route: "Side-event route",
    topPicks: "Top Picks",
    alternatives: "Alternatives with conflicts",
    pdfDownload: "Download PDF",
    pdfButton: "PDF",
    themeSwitch: "Display theme",
    lightMode: "Light",
    darkMode: "Dark",
    score: "Score",
    organizers: "Organizers",
    venue: "Venue",
    moveNote: (venue: string, minutes: number) => `Move from ${venue}: ${minutes} min`,
    conflict: (title: string) => `Conflict: ${title}`,
    eventLink: "View on Luma",
    approval: "Approval required",
    free: "Free",
    official: "Official",
  },
} as const;

export function SideEventRecommenderApp() {
  const [mode, setMode] = useState<Mode>("diagnostic");
  const [locale, setLocale] = useState<Locale>("ja");
  const [theme, setTheme] = useState<Theme | null>(null);
  const [topics, setTopics] = useState<string[]>(["stablecoin", "ai", "investment"]);
  const [role, setRole] = useState("business");
  const [goals, setGoals] = useState<string[]>(["partnerships", "market_trends"]);
  const [freeText, setFreeText] = useState("");
  const [basics, setBasics] = useState<Basics>(initialBasics);
  const [sideEventInfo, setSideEventInfo] = useState<SideEventInfo | null>(null);
  const [result, setResult] = useState<SideEventRecommendationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const t = UI_COPY[locale];
  const activeTheme = theme ?? "light";

  useEffect(() => {
    const storedLocale = window.localStorage.getItem("webx-locale");
    if (storedLocale === "ja" || storedLocale === "en") {
      setLocale(storedLocale);
    }
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("webx-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("webx-locale", locale);
  }, [locale]);

  useEffect(() => {
    if (!theme) {
      return;
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("webx-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/side-events")
      .then((response) => response.json())
      .then((json: SideEventInfo) => {
        setSideEventInfo(json);
        setBasics((current) => current.days.length > 0 ? current : { ...current, days: json.availableDays.map((day) => day.date) });
      })
      .catch(() => setSideEventInfo(null));
  }, []);

  const dayChoices = useMemo(() => {
    return (sideEventInfo?.availableDays ?? []).map((day) => ({
      id: day.date,
      label: formatDay(day.date, "ja"),
      labelEn: formatDay(day.date, "en"),
      description: `${day.count}件`,
      descriptionEn: `${day.count} event${day.count === 1 ? "" : "s"}`,
    }));
  }, [sideEventInfo?.availableDays]);

  const canSubmit = useMemo(() => {
    if (basics.days.length === 0) {
      return false;
    }
    if (mode === "diagnostic") {
      return topics.length > 0 && goals.length > 0;
    }
    return freeText.trim().length >= 1;
  }, [basics.days.length, freeText, goals.length, mode, topics.length]);

  async function submit() {
    setLoading(true);
    setError("");
    setResult(null);

    const payload = mode === "diagnostic"
      ? { mode, locale, basics, diagnostic: { topics, role, goals } }
      : { mode, locale, basics, freeText };

    try {
      const response = await fetch("/api/side-events/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || t.recommendError);
      }
      setResult(json);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.recommendError);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!result) {
      return;
    }

    setPdfLoading(true);
    setError("");
    try {
      const response = await fetch("/api/side-events/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!response.ok) {
        throw new Error(t.pdfError);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "webx-2026-side-events-route.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : t.pdfError);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">WebX 2026</p>
            <h1>{t.title}</h1>
            <p className="agenda-update-note">
              {t.updateNote}
              <span>{sideEventInfo ? t.updatedAt(formatUpdatedAt(sideEventInfo.lastUpdated, locale)) : t.updatedAtPending}</span>
            </p>
          </div>
          <div className="topbar-actions">
            <a className="home-link" href="/" aria-label={t.sessions} title={t.sessions}>
              <Home size={16} aria-hidden />
              <span>{t.sessions}</span>
            </a>
            <a className="home-link" href={LUMA_SIDE_EVENTS_URL} target="_blank" rel="noopener noreferrer" aria-label={t.source} title={t.source}>
              <ExternalLink size={16} aria-hidden />
              <span>{t.source}</span>
            </a>
            <button
              className="theme-toggle"
              onClick={() => setTheme(activeTheme === "dark" ? "light" : "dark")}
              type="button"
              aria-label={activeTheme === "dark" ? t.lightMode : t.darkMode}
              title={activeTheme === "dark" ? t.lightMode : t.darkMode}
            >
              {activeTheme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
              <span>{activeTheme === "dark" ? t.lightMode : t.darkMode}</span>
            </button>
            <div className="locale-switch" role="group" aria-label={t.localeSwitch}>
              <Languages size={16} aria-hidden />
              <button className={locale === "ja" ? "active" : ""} onClick={() => setLocale("ja")} type="button">
                日本語
              </button>
              <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")} type="button">
                English
              </button>
            </div>
            <div className="agenda-pill">
              <CalendarDays size={16} aria-hidden />
              <span>{sideEventInfo ? t.eventCount(sideEventInfo.eventCount) : t.sourceLoading}</span>
            </div>
          </div>
        </header>

        <div className="panel-grid">
          <section className="input-panel" aria-label={t.inputPanelAria}>
            <div className="segmented" role="tablist" aria-label={t.modeTabsAria}>
              <button className={mode === "diagnostic" ? "active" : ""} onClick={() => setMode("diagnostic")} type="button">
                <Check size={16} aria-hidden />
                {t.diagnostic}
              </button>
              <button className={mode === "freeText" ? "active" : ""} onClick={() => setMode("freeText")} type="button">
                <Sparkles size={16} aria-hidden />
                {t.freeText}
              </button>
            </div>

            {mode === "diagnostic" ? (
              <div className="form-stack">
                <Fieldset title={t.fields.topics} fieldId="topics" locale={locale} selectionMode="multi">
                  <ChipGrid items={TOPIC_OPTIONS} locale={locale} selected={topics} selectionMode="multi" onToggle={(id) => setTopics(toggle(topics, id))} />
                </Fieldset>
                <Fieldset title={t.fields.role} fieldId="role" locale={locale} selectionMode="single">
                  <div className="option-row" data-selection-mode="single">
                    {ROLE_OPTIONS.map((item) => (
                      <ChoiceButton
                        baseClass="option"
                        item={item}
                        key={item.id}
                        locale={locale}
                        onClick={() => setRole(item.id)}
                        selected={role === item.id}
                        selectionMode="single"
                      />
                    ))}
                  </div>
                </Fieldset>
                <Fieldset title={t.fields.goals} fieldId="goals" locale={locale} selectionMode="multi">
                  <ChipGrid items={GOAL_OPTIONS} locale={locale} selected={goals} selectionMode="multi" onToggle={(id) => setGoals(toggle(goals, id))} />
                </Fieldset>
              </div>
            ) : (
              <div className="form-stack">
                <label className="textarea-label" htmlFor="sideEventFreeText">{t.fields.freeTextGoal}</label>
                <textarea
                  id="sideEventFreeText"
                  value={freeText}
                  onChange={(event) => setFreeText(event.target.value)}
                  placeholder={t.freeTextPlaceholder}
                />
              </div>
            )}

            <div className="form-stack compact">
              <Fieldset title={t.fields.days} fieldId="days" locale={locale} selectionMode="multi">
                <div className="option-row" data-selection-mode="multi">
                  {dayChoices.map((item) => (
                    <ChoiceButton
                      baseClass="option"
                      item={item}
                      key={item.id}
                      locale={locale}
                      onClick={() => setBasics({ ...basics, days: toggle(basics.days, item.id) })}
                      selected={basics.days.includes(item.id)}
                      selectionMode="multi"
                    />
                  ))}
                </div>
              </Fieldset>

              <Fieldset title={t.fields.language} fieldId="language" locale={locale} selectionMode="single">
                <div className="option-row" data-selection-mode="single">
                  {LANGUAGE_OPTIONS.map((item) => (
                    <ChoiceButton
                      baseClass="option"
                      item={item}
                      key={item.id}
                      locale={locale}
                      onClick={() => setBasics({ ...basics, language: item.id as Basics["language"] })}
                      selected={basics.language === item.id}
                      selectionMode="single"
                    />
                  ))}
                </div>
              </Fieldset>

              <Fieldset title={t.fields.density} fieldId="density" locale={locale} selectionMode="single">
                <div className="option-row" data-selection-mode="single">
                  {DENSITY_OPTIONS.map((item) => (
                    <ChoiceButton
                      baseClass="option"
                      item={item}
                      key={item.id}
                      locale={locale}
                      onClick={() => setBasics({ ...basics, density: item.id as Basics["density"] })}
                      selected={basics.density === item.id}
                      selectionMode="single"
                    />
                  ))}
                </div>
              </Fieldset>
            </div>

            <button className="primary-button" disabled={!canSubmit || loading} onClick={submit} type="button">
              {loading ? <Loader2 className="spin" size={18} aria-hidden /> : <Route size={18} aria-hidden />}
              {t.generate}
            </button>
            {error ? <p className="error-text">{error}</p> : null}
          </section>

          <section className="result-panel" aria-label={t.resultPanelAria}>
            {!result ? (
              <EmptyState locale={locale} />
            ) : (
              <ResultView result={result} locale={locale} pdfLoading={pdfLoading} onDownloadPdf={downloadPdf} />
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function Fieldset({
  title,
  children,
  fieldId,
  locale,
  selectionMode,
}: {
  title: string;
  children: ReactNode;
  fieldId: string;
  locale: Locale;
  selectionMode: SelectionMode;
}) {
  const t = UI_COPY[locale];
  return (
    <fieldset data-field={fieldId} data-selection-mode={selectionMode}>
      <legend>
        <span className="legend-text">{title}</span>
        <span className={`selection-hint selection-hint-${selectionMode}`}>{t.selectionMode[selectionMode]}</span>
      </legend>
      {children}
    </fieldset>
  );
}

function ChipGrid({
  items,
  locale,
  selected,
  selectionMode,
  onToggle,
}: {
  items: readonly LocalizedChoice[];
  locale: Locale;
  selected: string[];
  selectionMode: SelectionMode;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="chip-grid" data-selection-mode={selectionMode}>
      {items.map((item) => (
        <ChoiceButton
          baseClass="chip"
          item={item}
          key={item.id}
          locale={locale}
          onClick={() => onToggle(item.id)}
          selected={selected.includes(item.id)}
          selectionMode={selectionMode}
        />
      ))}
    </div>
  );
}

function ChoiceButton({
  baseClass,
  item,
  locale,
  onClick,
  selected,
  selectionMode,
}: {
  baseClass: "chip" | "option";
  item: LocalizedChoice;
  locale: Locale;
  onClick: () => void;
  selected: boolean;
  selectionMode: SelectionMode;
}) {
  const description = choiceDescription(item, locale);
  return (
    <button
      aria-pressed={selected}
      className={choiceButtonClassName(baseClass, selectionMode, selected)}
      data-selected={selected ? "true" : "false"}
      data-selection-mode={selectionMode}
      onClick={onClick}
      type="button"
    >
      <span className="choice-indicator" aria-hidden />
      <span className="choice-copy">
        <span className="choice-label">{choiceLabel(item, locale)}</span>
        {description ? <span className="choice-description">{description}</span> : null}
      </span>
    </button>
  );
}

function EmptyState({ locale }: { locale: Locale }) {
  const t = UI_COPY[locale];
  return (
    <div className="empty-state side-event-empty">
      <MapPinned size={34} aria-hidden />
      <h2>{t.emptyTitle}</h2>
      <p>{t.emptyVenue}</p>
    </div>
  );
}

function ResultView({
  result,
  locale,
  pdfLoading,
  onDownloadPdf,
}: {
  result: SideEventRecommendationResult;
  locale: Locale;
  pdfLoading: boolean;
  onDownloadPdf: () => void;
}) {
  const t = UI_COPY[locale];
  return (
    <div className="result-stack">
      <div className="result-header">
        <div>
          <p className="eyebrow">{result.model.source === "gemini" ? "Gemini" : t.localScoring}</p>
          <h2>{t.routeCount(result.route.length)}</h2>
        </div>
        <button className="icon-button pdf-button" onClick={onDownloadPdf} disabled={pdfLoading} type="button" title={t.pdfDownload} aria-label={t.pdfDownload}>
          {pdfLoading ? <Loader2 className="spin" size={18} aria-hidden /> : <Download size={18} aria-hidden />}
          <span>{t.pdfButton}</span>
        </button>
      </div>

      <p className="summary-text">{result.summary}</p>

      <section className="timeline-section">
        <h3>{t.route}</h3>
        <div className="timeline">
          {result.route.map((event, index) => (
            <article className="timeline-item" key={event.id}>
              <div className="stage-dot side-event-dot" />
              <div>
                <div className="session-meta">
                  <span>{event.dayLabel}</span>
                  <span>{event.startTime} - {event.endTime}</span>
                  <span>{event.venueName}</span>
                </div>
                <h4>{event.title}</h4>
                <p className="speaker-line">{t.organizers}: {organizerNames(event.organizers)}</p>
                <TicketBadges event={event} locale={locale} />
                {event.moveFromPrevious ? (
                  <p className="move-note">{t.moveNote(event.moveFromPrevious.fromVenue, event.moveFromPrevious.minutes)}</p>
                ) : null}
                <EventLink event={event} locale={locale} />
              </div>
              <span className="rank">{index + 1}</span>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3>{t.topPicks}</h3>
        <div className="card-list side-event-card-list">
          {result.recommendations.slice(0, 6).map((event) => (
            <EventCard key={event.id} event={event} locale={locale} />
          ))}
        </div>
      </section>

      {result.alternatives.length > 0 ? (
        <section>
          <h3>{t.alternatives}</h3>
          <div className="card-list side-event-card-list">
            {result.alternatives.slice(0, 5).map((event) => (
              <EventCard key={event.id} event={event} locale={locale} conflictWith={event.conflictWith} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EventCard({
  event,
  locale,
  conflictWith,
}: {
  event: SideEventRecommendationResult["recommendations"][number];
  locale: Locale;
  conflictWith?: string;
}) {
  const t = UI_COPY[locale];
  return (
    <article className="session-card side-event-card">
      <div className="session-card-head">
        <span className="stage-badge side-event-badge">{event.language}</span>
        <span className="score">{t.score} {Math.round(event.score)}</span>
      </div>
      <div className="session-meta">
        <span>{event.dayLabel}</span>
        <span>{event.startTime} - {event.endTime}</span>
        <span>{event.venueName}</span>
      </div>
      <h4>{event.title}</h4>
      <p className="speaker-line">{t.organizers}: {organizerNames(event.organizers)}</p>
      <TicketBadges event={event} locale={locale} />
      {conflictWith ? <p className="conflict">{t.conflict(conflictWith)}</p> : null}
      <EventLink event={event} locale={locale} />
    </article>
  );
}

function TicketBadges({
  event,
  locale,
}: {
  event: Pick<SideEventRecommendationResult["recommendations"][number], "registration" | "isOfficial">;
  locale: Locale;
}) {
  const t = UI_COPY[locale];
  if (!event.registration.free && !event.registration.approvalRequired && !event.isOfficial) {
    return null;
  }

  return (
    <div className="ticket-badges">
      {event.registration.free ? (
        <span><Ticket size={12} aria-hidden />{t.free}</span>
      ) : null}
      {event.registration.approvalRequired ? (
        <span><Users size={12} aria-hidden />{t.approval}</span>
      ) : null}
      {event.isOfficial ? <span>{t.official}</span> : null}
    </div>
  );
}

function EventLink({ event, locale }: { event: Pick<SideEventRecommendationResult["recommendations"][number], "url">; locale: Locale }) {
  const t = UI_COPY[locale];
  return (
    <a className="session-link" href={event.url} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={14} aria-hidden />
      {t.eventLink}
    </a>
  );
}

function formatUpdatedAt(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
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

function choiceLabel(item: LocalizedChoice, locale: Locale): string {
  if (locale === "en") {
    return item.labelEn ?? item.displayEn ?? item.label ?? item.display ?? item.id;
  }
  return item.label ?? item.display ?? item.labelEn ?? item.displayEn ?? item.id;
}

function choiceDescription(item: LocalizedChoice, locale: Locale): string | undefined {
  if (locale === "en") {
    return item.descriptionEn ?? item.description;
  }
  return item.description ?? item.descriptionEn;
}

function organizerNames(organizers: readonly string[]): string {
  return organizers.length > 0 ? organizers.slice(0, 4).join(" / ") : "TBA";
}

function toggle<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function choiceButtonClassName(baseClass: "chip" | "option", selectionMode: SelectionMode, selected: boolean): string {
  return [baseClass, `selection-${selectionMode}`, selected ? "selected" : ""]
    .filter(Boolean)
    .join(" ");
}
