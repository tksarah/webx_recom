import { GoogleGenAI } from "@google/genai";
import { buildFallbackSideEventRecommendation } from "./side-event-scoring";
import {
  SideEvent,
  SideEventGeminiRecommendation,
  sideEventGeminiRecommendationSchema,
  SideEventRecommendRequest,
} from "./types";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export async function scoreSideEventsWithGemini(
  request: SideEventRecommendRequest,
  events: SideEvent[],
): Promise<{ recommendation: SideEventGeminiRecommendation; source: "gemini" | "local-fallback"; model: string; latencyMs: number }> {
  const started = Date.now();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  if (process.env.DISABLE_GEMINI === "1" || !process.env.GEMINI_API_KEY) {
    return {
      recommendation: buildFallbackSideEventRecommendation(request, events),
      source: "local-fallback",
      model,
      latencyMs: Date.now() - started,
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: buildPrompt(request, events),
      config: {
        systemInstruction: `You recommend Web3 conference side events. Return only valid JSON that matches the schema. Write the summary, reasons, and notes in ${outputLanguage(request)}.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            profileTags: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
            eventScores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  eventId: { type: "string" },
                  score: { type: "number" },
                  reason: { type: "string" },
                  note: { type: "string" },
                  matchedThemes: { type: "array", items: { type: "string" } },
                },
                required: ["eventId", "score", "reason", "matchedThemes"],
              },
            },
          },
          required: ["profileTags", "summary", "eventScores"],
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
    console.error("Gemini side-event recommendation failed; falling back locally.", error);
    return {
      recommendation: buildFallbackSideEventRecommendation(request, events),
      source: "local-fallback",
      model,
      latencyMs: Date.now() - started,
    };
  }
}

function buildPrompt(request: SideEventRecommendRequest, events: SideEvent[]): string {
  const filtered = events
    .filter((event) => request.basics.days.includes(event.date))
    .map((event) => ({
      id: event.id,
      date: event.date,
      time: `${event.startTime}-${event.endTime}`,
      venue: event.venueName,
      language: event.language,
      title: event.title,
      organizers: event.organizers,
      tags: event.tags,
      registration: event.registration,
      description: event.rawText.slice(0, 900),
      isOfficial: event.isOfficial,
    }));

  return JSON.stringify({
    task: `Score each WebX 2026 side event from 0 to 100 for the participant. Prefer practical networking, learning, and business-development fit. Mention approval or ticket constraints in notes when useful. Do not select routes; only score events.`,
    participant: {
      mode: request.mode,
      outputLocale: request.locale,
      basics: request.basics,
      diagnostic: request.diagnostic ?? null,
      freeText: request.mode === "freeText" ? request.freeText : undefined,
    },
    events: filtered,
  });
}

function outputLanguage(request: SideEventRecommendRequest): string {
  return request.locale === "en" ? "English" : "Japanese";
}

function parseGeminiJson(text: string): SideEventGeminiRecommendation {
  const json = JSON.parse(text);
  return sideEventGeminiRecommendationSchema.parse(json);
}
