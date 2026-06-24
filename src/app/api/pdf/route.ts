import { NextResponse } from "next/server";
import { ApiRequestError, apiErrorMessage, checkRateLimit, rateLimitMessage, readJsonBody, requestLocaleFromHeaders } from "@/lib/api-guard";
import { renderRecommendationPdf } from "@/lib/pdf";
import { recommendationResultSchema } from "@/lib/types";

export const runtime = "nodejs";

const REQUEST_BODY_LIMIT_BYTES = 256 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;

export async function POST(request: Request) {
  const fallbackLocale = requestLocaleFromHeaders(request);

  try {
    const rateLimit = checkRateLimit(request, {
      namespace: "pdf",
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
    const locale = isEnglishPdfRequest(json) ? "en" : "ja";
    const parsed = recommendationResultSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: locale === "en" ? "Please check the PDF input." : "PDFの入力内容を確認してください",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const pdf = await renderRecommendationPdf(parsed.data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="webx-2026-route.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: apiErrorMessage(error, fallbackLocale) }, { status: error.status });
    }

    console.error("PDF API failed.", error);
    return NextResponse.json({ error: "PDFの生成に失敗しました" }, { status: 500 });
  }
}

function isEnglishPdfRequest(json: unknown): boolean {
  if (typeof json !== "object" || json === null || !("requestSummary" in json)) {
    return false;
  }

  const requestSummary = (json as { requestSummary?: unknown }).requestSummary;
  return typeof requestSummary === "object"
    && requestSummary !== null
    && "locale" in requestSummary
    && (requestSummary as { locale?: unknown }).locale === "en";
}
