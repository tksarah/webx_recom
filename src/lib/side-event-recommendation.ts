import { scoreSideEventsWithGemini } from "./side-event-gemini";
import {
  buildOptimizedSideEventRoute,
  buildSideEventAlternatives,
  createSideEventRecommendationItems,
} from "./side-event-scheduler";
import { SideEventData, SideEventRecommendationResult, SideEventRecommendRequest } from "./types";

export async function recommendSideEvents(
  request: SideEventRecommendRequest,
  sideEvents: SideEventData,
): Promise<SideEventRecommendationResult> {
  const scopedEvents = sideEvents.events.filter((event) => request.basics.days.includes(event.date));
  const scored = await scoreSideEventsWithGemini(request, scopedEvents);
  const items = createSideEventRecommendationItems(scopedEvents, scored.recommendation, request);
  const route = buildOptimizedSideEventRoute(items, request.basics.density);
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
    sideEventsUpdatedAt: sideEvents.lastUpdated,
    model: {
      name: scored.model,
      source: scored.source,
      latencyMs: scored.latencyMs,
    },
    profileTags: scored.recommendation.profileTags,
    summary: scored.recommendation.summary,
    route,
    recommendations,
    alternatives: buildSideEventAlternatives(items, route),
    notes: buildNotes(request.locale, scored.source),
  };
}

function buildNotes(locale: SideEventRecommendRequest["locale"], source: "gemini" | "local-fallback"): string[] {
  if (locale === "en") {
    return [
      "Side events at different venues are scheduled with a 45-minute movement buffer.",
      "Please confirm registration, approval, venue, and ticket requirements on Luma or the official event page before attending.",
      source === "local-fallback"
        ? "Gemini API was not used, so this route is a provisional local recommendation."
        : "Recommendation reasons are generated from Gemini API structured output.",
    ];
  }

  return [
    "別会場のサイドイベント間には45分の移動バッファを見ています。",
    "参加前にLumaまたは公式ページで、登録・承認・会場・チケット条件を必ず確認してください。",
    source === "local-fallback"
      ? "Gemini API未使用のため、ローカル評価による暫定推薦です。"
      : "Gemini APIの構造化出力をもとに推薦理由を生成しています。",
  ];
}
