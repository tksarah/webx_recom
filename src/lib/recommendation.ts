import { AgendaData, RecommendationResult, RecommendRequest } from "./types";
import { scoreSessionsWithGemini } from "./gemini";
import { buildAlternatives, buildOptimizedRoute, createRecommendationItems } from "./scheduler";

export async function recommendSessions(request: RecommendRequest, agenda: AgendaData): Promise<RecommendationResult> {
  const scopedSessions = agenda.sessions.filter((session) => request.basics.days.includes(session.date));
  const scored = await scoreSessionsWithGemini(request, scopedSessions);
  const items = createRecommendationItems(scopedSessions, scored.recommendation, request);
  const route = buildOptimizedRoute(items, request.basics.density);
  const selected = new Set(route.map((item) => item.id));
  const recommendations = [
    ...route,
    ...items.filter((item) => !selected.has(item.id)),
  ].slice(0, 14);

  return {
    requestSummary: {
      mode: request.mode,
      locale: request.locale,
      topics: request.mode === "diagnostic" ? request.diagnostic?.topics ?? [] : scored.recommendation.profileTags,
      role: request.mode === "diagnostic" ? request.diagnostic?.role : undefined,
      goals: request.mode === "diagnostic" ? request.diagnostic?.goals ?? [] : [],
      days: request.basics.days,
      language: request.basics.language,
      density: request.basics.density,
      generatedAt: new Date().toISOString(),
    },
    agendaUpdatedAt: agenda.lastUpdated,
    model: {
      name: scored.model,
      source: scored.source,
      latencyMs: scored.latencyMs,
    },
    profileTags: scored.recommendation.profileTags,
    summary: scored.recommendation.summary,
    route,
    recommendations,
    alternatives: buildAlternatives(items, route),
    notes: buildNotes(request.locale, scored.source),
  };
}

function buildNotes(locale: RecommendRequest["locale"], source: "gemini" | "local-fallback"): string[] {
  if (locale === "en") {
    return [
      "Only one session is selected for overlapping time slots, with a 5-minute buffer for stage changes.",
      source === "local-fallback"
        ? "Gemini API was not used, so this route is a provisional local recommendation."
        : "Recommendation reasons are generated from Gemini API structured output.",
    ];
  }

  return [
    "同時刻のセッションは1つだけ選び、別ステージへの移動には5分の余白を見ています。",
    source === "local-fallback"
      ? "Gemini API未使用のため、ローカル評価による暫定推薦です。"
      : "Gemini APIの構造化出力をもとに推薦理由を生成しています。",
  ];
}
