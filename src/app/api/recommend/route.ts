import { NextResponse } from "next/server";
import { getAgenda } from "@/lib/agenda";
import { writeAnalytics } from "@/lib/analytics";
import { recommendSessions } from "@/lib/recommendation";
import { recommendRequestSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const locale = json?.locale === "en" ? "en" : "ja";
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
    console.error("Recommendation API failed.", error);
    return NextResponse.json(
      { error: "おすすめルートの作成に失敗しました" },
      { status: 500 },
    );
  }
}
