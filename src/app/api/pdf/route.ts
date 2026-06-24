import { NextResponse } from "next/server";
import { renderRecommendationPdf } from "@/lib/pdf";
import { recommendationResultSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const locale = json?.requestSummary?.locale === "en" ? "en" : "ja";
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
    console.error("PDF API failed.", error);
    return NextResponse.json({ error: "PDFの生成に失敗しました" }, { status: 500 });
  }
}
