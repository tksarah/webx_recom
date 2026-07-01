import { NextResponse } from "next/server";
import { ApiRequestError, apiErrorMessage, checkRateLimit, rateLimitMessage, readJsonBody, requestLocaleFromHeaders } from "@/lib/api-guard";
import { writeSideEventAnalytics } from "@/lib/analytics";
import { recommendSideEvents } from "@/lib/side-event-recommendation";
import { getSideEvents } from "@/lib/side-events";
import { sideEventRecommendRequestSchema } from "@/lib/types";

export const runtime = "nodejs";

const REQUEST_BODY_LIMIT_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

export async function POST(request: Request) {
  const fallbackLocale = requestLocaleFromHeaders(request);

  try {
    const rateLimit = checkRateLimit(request, {
      namespace: "side-events-recommend",
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimitMessage(fallbackLocale) },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const json = await readJsonBody(request, REQUEST_BODY_LIMIT_BYTES);
    const locale = isEnglishRequest(json) ? "en" : "ja";
    const parsed = sideEventRecommendRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: locale === "en" ? "Please check your side-event input." : "サイドイベントの入力内容を確認してください。",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const sideEvents = getSideEvents();
    const availableDays = new Set(sideEvents.events.map((event) => event.date));
    const missingDays = parsed.data.basics.days.filter((day) => !availableDays.has(day));
    if (missingDays.length > 0) {
      return NextResponse.json(
        {
          error: locale === "en"
            ? "Please choose a day with listed side events."
            : "掲載されているサイドイベントの日付を選択してください。",
        },
        { status: 400 },
      );
    }

    const result = await recommendSideEvents(parsed.data, sideEvents);

    writeSideEventAnalytics(parsed.data, result).catch((error) => {
      console.error("Failed to write anonymous side-event analytics.", error);
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: apiErrorMessage(error, fallbackLocale) }, { status: error.status });
    }

    console.error("Side-event recommendation API failed.", error);
    return NextResponse.json(
      { error: fallbackLocale === "en" ? "Failed to generate a side-event route." : "サイドイベントルートの作成に失敗しました。" },
      { status: 500 },
    );
  }
}

function isEnglishRequest(json: unknown): boolean {
  return typeof json === "object" && json !== null && "locale" in json && (json as { locale?: unknown }).locale === "en";
}
