import { GoogleGenAI } from "@google/genai";
import { buildFallbackRecommendation } from "./scoring";
import { AgendaSession, GeminiRecommendation, geminiRecommendationSchema, RecommendRequest } from "./types";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export async function scoreSessionsWithGemini(
  request: RecommendRequest,
  sessions: AgendaSession[],
): Promise<{ recommendation: GeminiRecommendation; source: "gemini" | "local-fallback"; model: string; latencyMs: number }> {
  const started = Date.now();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  if (process.env.DISABLE_GEMINI === "1" || !process.env.GEMINI_API_KEY) {
    return {
      recommendation: buildFallbackRecommendation(request, sessions),
      source: "local-fallback",
      model,
      latencyMs: Date.now() - started,
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: buildPrompt(request, sessions),
      config: {
        systemInstruction: `You recommend conference sessions. Return only valid JSON that matches the schema. Write the summary, reasons, and notes in ${outputLanguage(request)}.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            profileTags: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
            sessionScores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sessionId: { type: "string" },
                  score: { type: "number" },
                  reason: { type: "string" },
                  note: { type: "string" },
                  matchedThemes: { type: "array", items: { type: "string" } },
                },
                required: ["sessionId", "score", "reason", "matchedThemes"],
              },
            },
          },
          required: ["profileTags", "summary", "sessionScores"],
        },
      } as never,
    });

    const parsed = parseGeminiJson(response.text ?? "");
    return {
      recommendation: parsed,
      source: "gemini",
      model,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    console.error("Gemini recommendation failed; falling back locally.", error);
    return {
      recommendation: buildFallbackRecommendation(request, sessions),
      source: "local-fallback",
      model,
      latencyMs: Date.now() - started,
    };
  }
}

function buildPrompt(request: RecommendRequest, sessions: AgendaSession[]): string {
  const filtered = sessions
    .filter((session) => request.basics.days.includes(session.date))
    .map((session) => ({
      id: session.id,
      date: session.date,
      time: `${session.startTime}-${session.endTime}`,
      language: session.language,
      stage: session.stage,
      title: session.title,
      speakers: session.speakers,
      categories: session.categories,
      description: session.rawText.slice(0, 600),
      isPlaceholder: session.isPlaceholder,
    }));

  return JSON.stringify({
    task: `Score each WebX 2026 session from 0 to 100 for the participant. Prefer actionable, specific reasons in ${outputLanguage(request)}. Penalize COMING SOON/TBA sessions. Do not select routes; only score sessions.`,
    participant: {
      mode: request.mode,
      outputLocale: request.locale,
      basics: request.basics,
      diagnostic: request.diagnostic ?? null,
      freeText: request.mode === "freeText" ? request.freeText : undefined,
    },
    sessions: filtered,
  });
}

function outputLanguage(request: RecommendRequest): string {
  return request.locale === "en" ? "English" : "Japanese";
}

function parseGeminiJson(text: string): GeminiRecommendation {
  const json = JSON.parse(text);
  return geminiRecommendationSchema.parse(json);
}
