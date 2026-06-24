"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Check, Download, ExternalLink, Home, Languages, Loader2, MapPinned, Moon, Route, Sparkles, Sun } from "lucide-react";
import {
  DENSITY_OPTIONS,
  EVENT_DAYS,
  GOAL_OPTIONS,
  LANGUAGE_OPTIONS,
  ROLE_OPTIONS,
  STAGES,
  TOPIC_OPTIONS,
  WEBX_AGENDA_URL,
} from "@/lib/constants";
import type { RecommendationResult } from "@/lib/types";

type Mode = "diagnostic" | "freeText";
type Locale = "ja" | "en";
type Theme = "light" | "dark";
type Basics = {
  days: Array<"2026-07-13" | "2026-07-14">;
  language: "both" | "ja" | "en";
  density: "balanced" | "relaxed" | "packed";
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
  days: ["2026-07-13", "2026-07-14"],
  language: "both",
  density: "balanced",
};

const UI_COPY = {
  ja: {
    title: "WebX 2026 おすすめセッションルート",
    agendaLoading: "Agenda読込中",
    agendaCount: (count: number) => `${count}件のセッション`,
    agendaUpdateNote: "元のサイトのAgendaは更新が断続的なため、本サイトは1日に1、2回更新されます。",
    agendaUpdatedAt: (value: string) => `最新の更新日時: ${value}`,
    agendaUpdatedAtPending: "最新の更新日時: 読込中",
    inputPanelAria: "推薦条件入力",
    resultPanelAria: "推薦結果",
    modeTabsAria: "入力モード",
    diagnostic: "かんたん診断",
    freeText: "自由入力",
    fields: {
      topics: "興味テーマ",
      role: "あなたの立場",
      goals: "参加目的",
      freeTextGoal: "参加目的",
      days: "参加日",
      language: "希望言語",
      density: "回り方",
    },
    freeTextPlaceholder: "例: AIエージェントとステーブルコイン決済の事業機会を中心に、投資家や大企業の登壇を優先したい",
    generate: "おすすめルートを作成",
    recommendError: "おすすめルートの作成に失敗しました",
    pdfError: "PDFの生成に失敗しました",
    home: "ホーム",
    localeSwitch: "表示言語",
    emptyTitle: "7月13日-14日",
    emptyVenue: "ザ・プリンス パークタワー東京",
    localScoring: "ローカル評価",
    routeCount: (count: number) => `${count}件のルート`,
    route: "参加ルート",
    topPicks: "おすすめ上位",
    alternatives: "時間が重なる代替候補",
    pdfDownload: "PDFをダウンロード",
    pdfButton: "PDF",
    themeSwitch: "表示テーマ",
    lightMode: "ライト",
    darkMode: "ダーク",
    score: "スコア",
    speakers: "登壇者",
    moveNote: (stage: string, minutes: number) => `${stage} から移動 ${minutes}分`,
    conflict: (title: string) => `時間重複: ${title}`,
    sessionLink: "公式Agendaで確認",
  },
  en: {
    title: "WebX 2026 Recommended Session Route",
    agendaLoading: "Loading agenda",
    agendaCount: (count: number) => `${count} sessions`,
    agendaUpdateNote: "The original Agenda is updated intermittently, so this site is refreshed once or twice a day.",
    agendaUpdatedAt: (value: string) => `Last updated: ${value}`,
    agendaUpdatedAtPending: "Last updated: loading",
    inputPanelAria: "Recommendation input",
    resultPanelAria: "Recommendation result",
    modeTabsAria: "Input mode",
    diagnostic: "Quick diagnosis",
    freeText: "Free text",
    fields: {
      topics: "Topics",
      role: "Role",
      goals: "Goals",
      freeTextGoal: "Participation goal",
      days: "Days",
      language: "Preferred language",
      density: "Route density",
    },
    freeTextPlaceholder: "Example: I want to focus on business opportunities around AI agents and stablecoin payments, prioritizing investors and enterprise speakers.",
    generate: "Generate route",
    recommendError: "Failed to generate a recommended route",
    pdfError: "Failed to generate PDF",
    home: "Home",
    localeSwitch: "Display language",
    emptyTitle: "July 13-14",
    emptyVenue: "The Prince Park Tower Tokyo",
    localScoring: "Local scoring",
    routeCount: (count: number) => `${count} route stop${count === 1 ? "" : "s"}`,
    route: "Route",
    topPicks: "Top Picks",
    alternatives: "Alternatives with conflicts",
    pdfDownload: "Download PDF",
    pdfButton: "PDF",
    themeSwitch: "Display theme",
    lightMode: "Light",
    darkMode: "Dark",
    score: "Score",
    speakers: "Speakers",
    moveNote: (stage: string, minutes: number) => `Move from ${stage}: ${minutes} min`,
    conflict: (title: string) => `Conflict: ${title}`,
    sessionLink: "View on official Agenda",
  },
} as const;

export function RecommenderApp() {
  const [mode, setMode] = useState<Mode>("diagnostic");
  const [locale, setLocale] = useState<Locale>("ja");
  const [theme, setTheme] = useState<Theme | null>(null);
  const [topics, setTopics] = useState<string[]>(["stablecoin", "ai", "rwa"]);
  const [role, setRole] = useState("business");
  const [goals, setGoals] = useState<string[]>(["market_trends", "partnerships"]);
  const [freeText, setFreeText] = useState("");
  const [basics, setBasics] = useState<Basics>(initialBasics);
  const [agendaInfo, setAgendaInfo] = useState<{ sessionCount: number; lastUpdated: string } | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
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
    fetch("/api/agenda")
      .then((response) => response.json())
      .then((json) => setAgendaInfo({ sessionCount: json.sessionCount, lastUpdated: json.lastUpdated }))
      .catch(() => setAgendaInfo(null));
  }, []);

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
      const response = await fetch("/api/recommend", {
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
      const response = await fetch("/api/pdf", {
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
      link.download = "webx-2026-route.pdf";
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
              {t.agendaUpdateNote}
              <span>{agendaInfo ? t.agendaUpdatedAt(formatAgendaUpdatedAt(agendaInfo.lastUpdated, locale)) : t.agendaUpdatedAtPending}</span>
            </p>
          </div>
          <div className="topbar-actions">
            <a className="home-link" href="/" aria-label={t.home} title={t.home}>
              <Home size={16} aria-hidden />
              <span>{t.home}</span>
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
              <span>{agendaInfo ? t.agendaCount(agendaInfo.sessionCount) : t.agendaLoading}</span>
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
                <Fieldset title={t.fields.topics}>
                  <ChipGrid items={TOPIC_OPTIONS} locale={locale} selected={topics} onToggle={(id) => setTopics(toggle(topics, id))} />
                </Fieldset>
                <Fieldset title={t.fields.role}>
                  <div className="option-row">
                    {ROLE_OPTIONS.map((item) => (
                      <ChoiceButton
                        className={role === item.id ? "option selected" : "option"}
                        item={item}
                        key={item.id}
                        locale={locale}
                        onClick={() => setRole(item.id)}
                      />
                    ))}
                  </div>
                </Fieldset>
                <Fieldset title={t.fields.goals}>
                  <ChipGrid items={GOAL_OPTIONS} locale={locale} selected={goals} onToggle={(id) => setGoals(toggle(goals, id))} />
                </Fieldset>
              </div>
            ) : (
              <div className="form-stack">
                <label className="textarea-label" htmlFor="freeText">{t.fields.freeTextGoal}</label>
                <textarea
                  id="freeText"
                  value={freeText}
                  onChange={(event) => setFreeText(event.target.value)}
                  placeholder={t.freeTextPlaceholder}
                />
              </div>
            )}

            <div className="form-stack compact">
              <Fieldset title={t.fields.days}>
                <div className="option-row">
                  {EVENT_DAYS.map((item) => (
                    <ChoiceButton
                      className={basics.days.includes(item.id) ? "option selected" : "option"}
                      item={item}
                      key={item.id}
                      locale={locale}
                      onClick={() => setBasics({ ...basics, days: toggle(basics.days, item.id) as Basics["days"] })}
                    />
                  ))}
                </div>
              </Fieldset>

              <Fieldset title={t.fields.language}>
                <div className="option-row">
                  {LANGUAGE_OPTIONS.map((item) => (
                    <ChoiceButton
                      className={basics.language === item.id ? "option selected" : "option"}
                      item={item}
                      key={item.id}
                      locale={locale}
                      onClick={() => setBasics({ ...basics, language: item.id as Basics["language"] })}
                    />
                  ))}
                </div>
              </Fieldset>

              <Fieldset title={t.fields.density}>
                <div className="option-row">
                  {DENSITY_OPTIONS.map((item) => (
                    <ChoiceButton
                      className={basics.density === item.id ? "option selected" : "option"}
                      item={item}
                      key={item.id}
                      locale={locale}
                      onClick={() => setBasics({ ...basics, density: item.id as Basics["density"] })}
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

function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

function ChipGrid({
  items,
  locale,
  selected,
  onToggle,
}: {
  items: readonly LocalizedChoice[];
  locale: Locale;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="chip-grid">
      {items.map((item) => (
        <button className={selected.includes(item.id) ? "chip selected" : "chip"} key={item.id} onClick={() => onToggle(item.id)} type="button">
          <span className="choice-label">{choiceLabel(item, locale)}</span>
          {choiceDescription(item, locale) ? <span className="choice-description">{choiceDescription(item, locale)}</span> : null}
        </button>
      ))}
    </div>
  );
}

function ChoiceButton({ className, item, locale, onClick }: { className: string; item: LocalizedChoice; locale: Locale; onClick: () => void }) {
  return (
    <button className={className} onClick={onClick} type="button">
      <span className="choice-label">{choiceLabel(item, locale)}</span>
      {choiceDescription(item, locale) ? <span className="choice-description">{choiceDescription(item, locale)}</span> : null}
    </button>
  );
}

function EmptyState({ locale }: { locale: Locale }) {
  const t = UI_COPY[locale];
  return (
    <div className="empty-state">
      <div className="stage-map" aria-hidden>
        {STAGES.map((stage) => (
          <span key={stage} className={`stage-line ${stageClass(stage)}`} />
        ))}
      </div>
      <MapPinned size={32} aria-hidden />
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
  result: RecommendationResult;
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
          {result.route.map((session, index) => (
            <article className="timeline-item" key={session.id}>
              <div className={`stage-dot ${stageClass(session.stage)}`} />
              <div>
                <div className="session-meta">
                  <span>{session.dayLabel}</span>
                  <span>{session.startTime} - {session.endTime}</span>
                  <span>{session.stage}</span>
                </div>
                <h4>{session.title}</h4>
                <p className="speaker-line">{t.speakers}: {speakerNames(session.speakers)}</p>
                {session.moveFromPrevious ? (
                  <p className="move-note">{t.moveNote(session.moveFromPrevious.fromStage, session.moveFromPrevious.minutes)}</p>
                ) : null}
                <AgendaLink session={session} locale={locale} />
              </div>
              <span className="rank">{index + 1}</span>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3>{t.topPicks}</h3>
        <div className="card-list">
          {result.recommendations.slice(0, 6).map((session) => (
            <SessionCard key={session.id} session={session} locale={locale} />
          ))}
        </div>
      </section>

      {result.alternatives.length > 0 ? (
        <section>
          <h3>{t.alternatives}</h3>
          <div className="card-list">
            {result.alternatives.slice(0, 5).map((session) => (
              <SessionCard key={session.id} session={session} locale={locale} conflictWith={session.conflictWith} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SessionCard({
  session,
  locale,
  conflictWith,
}: {
  session: RecommendationResult["recommendations"][number];
  locale: Locale;
  conflictWith?: string;
}) {
  const t = UI_COPY[locale];
  return (
    <article className="session-card">
      <div className="session-card-head">
        <span className={`stage-badge ${stageClass(session.stage)}`}>{session.stage}</span>
        <span className="score">{t.score} {Math.round(session.score)}</span>
      </div>
      <div className="session-meta">
        <span>{session.dayLabel}</span>
        <span>{session.startTime} - {session.endTime}</span>
        <span>{session.language}</span>
      </div>
      <h4>{session.title}</h4>
      <p className="speaker-line">{t.speakers}: {speakerNames(session.speakers)}</p>
      {conflictWith ? <p className="conflict">{t.conflict(conflictWith)}</p> : null}
      <AgendaLink session={session} locale={locale} />
    </article>
  );
}

function AgendaLink({ session, locale }: { session: Pick<RecommendationResult["recommendations"][number], "isPlaceholder" | "title">; locale: Locale }) {
  const t = UI_COPY[locale];
  return (
    <a className="session-link" href={agendaSessionUrl(session)} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={14} aria-hidden />
      {t.sessionLink}
    </a>
  );
}

function agendaSessionUrl(session: Pick<RecommendationResult["recommendations"][number], "isPlaceholder" | "title">): string {
  const title = session.title.trim();
  if (session.isPlaceholder || /^(COMING SOON|TBA|詳細未公開)$/i.test(title)) {
    return WEBX_AGENDA_URL;
  }

  return `${WEBX_AGENDA_URL}#:~:text=${encodeURIComponent(title.slice(0, 120))}`;
}

function formatAgendaUpdatedAt(value: string, locale: Locale): string {
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

function speakerNames(speakers: readonly string[]): string {
  const names = speakers
    .map((speaker) => speaker.split(" / ")[0]?.trim())
    .filter((speaker): speaker is string => Boolean(speaker));

  return names.length > 0 ? names.slice(0, 4).join(" / ") : "COMING SOON";
}

function toggle<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function stageClass(stage: string): string {
  return stage.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
