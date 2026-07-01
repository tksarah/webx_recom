import {
  ScheduledSideEvent,
  SideEvent,
  SideEventGeminiRecommendation,
  SideEventRecommendRequest,
  SideEventRecommendationItem,
} from "./types";

type RouteState = {
  value: number;
  path: SideEventRecommendationItem[];
};

export const SIDE_EVENT_MOVE_BUFFER_MINUTES = 45;

const maxEventsByDensity: Record<SideEventRecommendRequest["basics"]["density"], number> = {
  relaxed: 1,
  balanced: 2,
  packed: 3,
};

export function createSideEventRecommendationItems(
  events: SideEvent[],
  ai: SideEventGeminiRecommendation,
  request: SideEventRecommendRequest,
): SideEventRecommendationItem[] {
  const scoreById = new Map(ai.eventScores.map((score) => [score.eventId, score]));

  return events
    .filter((event) => request.basics.days.includes(event.date))
    .map((event) => {
      const aiScore = scoreById.get(event.id);
      const score = applyLanguagePreference(aiScore?.score ?? 0, event, request.basics.language);

      return {
        ...event,
        score,
        reason: aiScore?.reason || defaultReason(request.locale),
        note: aiScore?.note || "",
        matchedThemes: aiScore?.matchedThemes ?? [],
      };
    })
    .sort((a, b) => b.score - a.score || a.startDateTime.localeCompare(b.startDateTime));
}

export function buildOptimizedSideEventRoute(
  items: SideEventRecommendationItem[],
  density: SideEventRecommendRequest["basics"]["density"],
): ScheduledSideEvent[] {
  const maxPerDay = maxEventsByDensity[density];
  const days = Array.from(new Set(items.map((item) => item.date))).sort();

  return days.flatMap((day) => {
    const dayItems = items
      .filter((item) => item.date === day && item.score > 0)
      .sort((a, b) => a.startMinutes - b.startMinutes || b.score - a.score);

    return optimizeDay(dayItems, maxPerDay).map((item, index, route) => {
      const previous = route[index - 1];
      if (!previous || previous.venueKey === item.venueKey) {
        return item;
      }

      return {
        ...item,
        moveFromPrevious: {
          fromVenue: previous.venueName,
          minutes: SIDE_EVENT_MOVE_BUFFER_MINUTES,
        },
      };
    });
  });
}

export function buildSideEventAlternatives(
  items: SideEventRecommendationItem[],
  route: ScheduledSideEvent[],
): Array<SideEventRecommendationItem & { conflictWith?: string }> {
  const selected = new Set(route.map((item) => item.id));

  return items
    .filter((item) => !selected.has(item.id))
    .filter((item) => item.score >= 35)
    .slice(0, 16)
    .map((item) => ({
      ...item,
      conflictWith: route.find((selectedItem) => !canAttendSideEventAfter(selectedItem, item) && !canAttendSideEventAfter(item, selectedItem))?.title,
    }))
    .slice(0, 8);
}

export function canAttendSideEventAfter(
  previous: Pick<SideEvent, "date" | "endMinutes" | "venueKey">,
  next: Pick<SideEvent, "date" | "startMinutes" | "venueKey">,
): boolean {
  if (previous.date !== next.date) {
    return true;
  }
  const buffer = previous.venueKey === next.venueKey ? 0 : SIDE_EVENT_MOVE_BUFFER_MINUTES;
  return next.startMinutes >= previous.endMinutes + buffer;
}

function optimizeDay(items: SideEventRecommendationItem[], maxCount: number): SideEventRecommendationItem[] {
  let states: RouteState[] = [{ value: 0, path: [] }];

  for (const item of items) {
    const additions = states
      .filter((state) => state.path.length < maxCount)
      .filter((state) => {
        const previous = state.path[state.path.length - 1];
        return !previous || canAttendSideEventAfter(previous, item);
      })
      .map((state) => {
        const previous = state.path[state.path.length - 1];
        const movementPenalty = previous && previous.venueKey !== item.venueKey ? 4 : 0;
        const approvalPenalty = item.registration.approvalRequired ? 2 : 0;
        return {
          value: state.value + item.score - movementPenalty - approvalPenalty,
          path: [...state.path, item],
        };
      });

    states = [...states, ...additions]
      .sort((a, b) => b.value - a.value || b.path.length - a.path.length)
      .slice(0, 2000);
  }

  return states[0]?.path.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes) ?? [];
}

function applyLanguagePreference(score: number, event: SideEvent, preference: SideEventRecommendRequest["basics"]["language"]): number {
  if (preference === "both" || event.language === "UNKNOWN") {
    return score;
  }
  if (event.language === "BILINGUAL") {
    return score + 8;
  }
  if (preference === "ja") {
    return event.language === "JA" ? score + 8 : score - 12;
  }
  return event.language === "EN" ? score + 8 : score - 12;
}

function defaultReason(locale: SideEventRecommendRequest["locale"]): string {
  return locale === "en"
    ? "Selected as a side-event candidate based on its relevance to your inputs."
    : "入力条件との関連度からサイドイベント候補にしました。";
}
