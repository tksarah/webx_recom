import { z } from "zod";
import { STAGES } from "./constants";

const topicIds = [
  "stablecoin",
  "rwa",
  "ai",
  "regulation",
  "bitcoin",
  "defi",
  "security",
  "enterprise",
  "payments",
  "infrastructure",
  "investment",
  "policy",
] as const;

const roleIds = ["business", "investor", "developer", "policy", "media", "student"] as const;

const goalIds = [
  "market_trends",
  "partnerships",
  "technical_learning",
  "regulatory_signal",
  "investment_signal",
  "speaker_priority",
] as const;

const dayIds = ["2026-07-13", "2026-07-14"] as const;
const languageIds = ["both", "ja", "en"] as const;
const densityIds = ["balanced", "relaxed", "packed"] as const;
const localeIds = ["ja", "en"] as const;

export const stageSchema = z.enum(STAGES);
export const sessionLanguageSchema = z.enum(["JA", "EN", "UNKNOWN"]);

export const agendaSessionSchema = z.object({
  id: z.string(),
  date: z.enum(dayIds),
  dayLabel: z.string(),
  language: sessionLanguageSchema,
  stage: stageSchema,
  startTime: z.string(),
  endTime: z.string(),
  startMinutes: z.number().int().min(0).max(24 * 60),
  endMinutes: z.number().int().min(0).max(24 * 60),
  title: z.string(),
  speakers: z.array(z.string()),
  categories: z.array(z.string()),
  rawText: z.string(),
  isPlaceholder: z.boolean(),
});

export const agendaDataSchema = z.object({
  event: z.literal("WebX 2026"),
  sourceUrl: z.string().url(),
  lastUpdated: z.string(),
  stages: z.array(stageSchema),
  sessions: z.array(agendaSessionSchema),
});

export const basicsSchema = z.object({
  days: z.array(z.enum(dayIds)).min(1),
  language: z.enum(languageIds),
  density: z.enum(densityIds),
});

export const diagnosticProfileSchema = z.object({
  topics: z.array(z.enum(topicIds)).min(1),
  role: z.enum(roleIds),
  goals: z.array(z.enum(goalIds)).min(1),
});

export const recommendRequestSchema = z.object({
  mode: z.enum(["diagnostic", "freeText"]),
  locale: z.enum(localeIds).optional().default("ja"),
  basics: basicsSchema,
  diagnostic: diagnosticProfileSchema.optional(),
  freeText: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (value.mode === "diagnostic" && !value.diagnostic) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diagnostic"],
      message: value.locale === "en" ? "Quick diagnosis input is incomplete." : "かんたん診断の入力内容が不足しています。",
    });
  }

  if (value.mode === "freeText" && (!value.freeText || value.freeText.length < 1)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["freeText"],
      message: value.locale === "en" ? "Please enter your free text goal." : "自由入力を入力してください。",
    });
  }
});

export const geminiScoreSchema = z.object({
  sessionId: z.string(),
  score: z.number().min(0).max(100),
  reason: z.string().min(1),
  note: z.string().optional().default(""),
  matchedThemes: z.array(z.string()).default([]),
});

export const geminiRecommendationSchema = z.object({
  profileTags: z.array(z.string()).default([]),
  summary: z.string().default(""),
  sessionScores: z.array(geminiScoreSchema),
});

export const recommendationItemSchema = agendaSessionSchema.extend({
  score: z.number(),
  reason: z.string(),
  note: z.string(),
  matchedThemes: z.array(z.string()),
});

export const scheduledSessionSchema = recommendationItemSchema.extend({
  moveFromPrevious: z.object({
    fromStage: z.string(),
    minutes: z.number(),
  }).optional(),
});

export const recommendationResultSchema = z.object({
  requestSummary: z.object({
    mode: z.enum(["diagnostic", "freeText"]),
    locale: z.enum(localeIds).default("ja"),
    topics: z.array(z.string()),
    role: z.string().optional(),
    goals: z.array(z.string()),
    days: z.array(z.string()),
    language: z.string(),
    density: z.string(),
    generatedAt: z.string(),
  }),
  agendaUpdatedAt: z.string(),
  model: z.object({
    name: z.string(),
    source: z.enum(["gemini", "local-fallback"]),
    latencyMs: z.number(),
  }),
  profileTags: z.array(z.string()),
  summary: z.string(),
  route: z.array(scheduledSessionSchema),
  recommendations: z.array(recommendationItemSchema),
  alternatives: z.array(recommendationItemSchema.extend({
    conflictWith: z.string().optional(),
  })),
  notes: z.array(z.string()),
});

export type AgendaSession = z.infer<typeof agendaSessionSchema>;
export type AgendaData = z.infer<typeof agendaDataSchema>;
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type GeminiRecommendation = z.infer<typeof geminiRecommendationSchema>;
export type GeminiScore = z.infer<typeof geminiScoreSchema>;
export type RecommendationItem = z.infer<typeof recommendationItemSchema>;
export type ScheduledSession = z.infer<typeof scheduledSessionSchema>;
export type RecommendationResult = z.infer<typeof recommendationResultSchema>;
