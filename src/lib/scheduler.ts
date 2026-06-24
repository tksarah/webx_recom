import { DEFAULT_MOVE_BUFFER_MINUTES } from "./constants";
import { AgendaSession, GeminiRecommendation, RecommendRequest, RecommendationItem, ScheduledSession } from "./types";

type RouteState = {
  value: number;
  path: RecommendationItem[];
};

const maxSessionsByDensity: Record<RecommendRequest["basics"]["density"], number> = {
  relaxed: 3,
  balanced: 5,
  packed: 8,
};

export function createRecommendationItems(
  sessions: AgendaSession[],
  ai: GeminiRecommendation,
  request: RecommendRequest,
): RecommendationItem[] {
  const scoreById = new Map(ai.sessionScores.map((score) => [score.sessionId, score]));

  return sessions
    .filter((session) => request.basics.days.includes(session.date))
    .map((session) => {
      const aiScore = scoreById.get(session.id);
      const languageAdjustedScore = applyLanguagePreference(aiScore?.score ?? 0, session, request.basics.language);
      const score = session.isPlaceholder ? Math.min(languageAdjustedScore, 30) : languageAdjustedScore;

      return {
        ...session,
        score,
        reason: aiScore?.reason || defaultReason(request.locale),
        note: aiScore?.note || "",
        matchedThemes: aiScore?.matchedThemes ?? [],
      };
    })
    .sort((a, b) => b.score - a.score || a.startMinutes - b.startMinutes);
}

export function buildOptimizedRoute(
  items: RecommendationItem[],
  density: RecommendRequest["basics"]["density"],
): ScheduledSession[] {
  const maxPerDay = maxSessionsByDensity[density];
  const days = Array.from(new Set(items.map((item) => item.date))).sort();

  return days.flatMap((day) => {
    const dayItems = items
      .filter((item) => item.date === day && item.score > 0)
      .sort((a, b) => a.startMinutes - b.startMinutes || b.score - a.score);

    return optimizeDay(dayItems, maxPerDay).map((item, index, route) => {
      const previous = route[index - 1];
      if (!previous || previous.stage === item.stage) {
        return item;
      }

      return {
        ...item,
        moveFromPrevious: {
          fromStage: previous.stage,
          minutes: DEFAULT_MOVE_BUFFER_MINUTES,
        },
      };
    });
  });
}

export function buildAlternatives(
  items: RecommendationItem[],
  route: ScheduledSession[],
): Array<RecommendationItem & { conflictWith?: string }> {
  const selected = new Set(route.map((item) => item.id));

  return items
    .filter((item) => !selected.has(item.id))
    .filter((item) => item.score >= 35)
    .slice(0, 16)
    .map((item) => ({
      ...item,
      conflictWith: route.find((selectedItem) => !canAttendAfter(selectedItem, item) && !canAttendAfter(item, selectedItem))?.title,
    }))
    .slice(0, 8);
}

function optimizeDay(items: RecommendationItem[], maxCount: number): RecommendationItem[] {
  let states: RouteState[] = [{ value: 0, path: [] }];

  for (const item of items) {
    const additions = states
      .filter((state) => state.path.length < maxCount)
      .filter((state) => {
        const previous = state.path[state.path.length - 1];
        return !previous || canAttendAfter(previous, item);
      })
      .map((state) => {
        const previous = state.path[state.path.length - 1];
        const movementPenalty = previous && previous.stage !== item.stage ? 1.5 : 0;
        const placeholderPenalty = item.isPlaceholder ? 6 : 0;
        return {
          value: state.value + item.score - movementPenalty - placeholderPenalty,
          path: [...state.path, item],
        };
      });

    states = [...states, ...additions]
      .sort((a, b) => b.value - a.value || b.path.length - a.path.length)
      .slice(0, 2000);
  }

  return states[0]?.path.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes) ?? [];
}

export function canAttendAfter(previous: Pick<AgendaSession, "endMinutes" | "stage" | "date">, next: Pick<AgendaSession, "startMinutes" | "stage" | "date">): boolean {
  if (previous.date !== next.date) {
    return true;
  }
  const buffer = previous.stage === next.stage ? 0 : DEFAULT_MOVE_BUFFER_MINUTES;
  return next.startMinutes >= previous.endMinutes + buffer;
}

function applyLanguagePreference(score: number, session: AgendaSession, preference: RecommendRequest["basics"]["language"]): number {
  if (preference === "both" || session.language === "UNKNOWN") {
    return score;
  }
  if (preference === "ja") {
    return session.language === "JA" ? score + 8 : score - 18;
  }
  return session.language === "EN" ? score + 8 : score - 18;
}

function defaultReason(locale: RecommendRequest["locale"]): string {
  return locale === "en"
    ? "Selected as a candidate based on its relevance to your inputs."
    : "入力条件との関連度から候補にしました。";
}
