import { NextResponse } from "next/server";
import { getAgenda } from "@/lib/agenda";
import { ApiRequestError, apiErrorMessage, checkRateLimit, rateLimitMessage, readJsonBody, requestLocaleFromHeaders } from "@/lib/api-guard";
import { writeAnalytics } from "@/lib/analytics";
import { recommendSessions } from "@/lib/recommendation";
import { recommendRequestSchema } from "@/lib/types";

export const runtime = "nodejs";

const REQUEST_BODY_LIMIT_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

export async function POST(request: Request) {
  const fallbackLocale = requestLocaleFromHeaders(request);

  try {
    const rateLimit = checkRateLimit(request, {
      namespace: "recommend",
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
    const parsed = recommendRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: locale === "en" ? "Please check your input." : "入力内容を確認してください",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const agenda = getAgenda();
    const result = await recommendSessions(parsed.data, agenda);

    writeAnalytics(parsed.data, result).catch((error) => {
      console.error("Failed to write anonymous analytics.", error);
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: apiErrorMessage(error, fallbackLocale) }, { status: error.status });
    }

    console.error("Recommendation API failed.", error);
    return NextResponse.json(
      { error: "おすすめルートの作成に失敗しました" },
      { status: 500 },
    );
  }
}

function isEnglishRequest(json: unknown): boolean {
  return typeof json === "object" && json !== null && "locale" in json && (json as { locale?: unknown }).locale === "en";
}
