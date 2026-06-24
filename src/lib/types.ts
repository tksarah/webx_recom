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

const compactText = z.string().max(120);
const mediumText = z.string().max(500);
const longText = z.string().max(2000);

export const stageSchema = z.enum(STAGES);
export const sessionLanguageSchema = z.enum(["JA", "EN", "UNKNOWN"]);

export const agendaSessionSchema = z.object({
  id: compactText,
  date: z.enum(dayIds),
  dayLabel: z.string().max(20),
  language: sessionLanguageSchema,
  stage: stageSchema,
  startTime: z.string().max(20),
  endTime: z.string().max(20),
  startMinutes: z.number().int().min(0).max(24 * 60),
  endMinutes: z.number().int().min(0).max(24 * 60),
  title: mediumText,
  speakers: z.array(z.string().max(200)).max(12),
  categories: z.array(compactText).max(20),
  rawText: longText,
  isPlaceholder: z.boolean(),
});

export const agendaDataSchema = z.object({
  event: z.literal("WebX 2026"),
  sourceUrl: z.string().url(),
  lastUpdated: z.string().max(80),
  stages: z.array(stageSchema).max(STAGES.length),
  sessions: z.array(agendaSessionSchema).max(300),
});

export const basicsSchema = z.object({
  days: z.array(z.enum(dayIds)).min(1).max(dayIds.length),
  language: z.enum(languageIds),
  density: z.enum(densityIds),
});

export const diagnosticProfileSchema = z.object({
  topics: z.array(z.enum(topicIds)).min(1).max(topicIds.length),
  role: z.enum(roleIds),
  goals: z.array(z.enum(goalIds)).min(1).max(goalIds.length),
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
  sessionId: compactText,
  score: z.number().min(0).max(100),
  reason: mediumText.min(1),
  note: mediumText.optional().default(""),
  matchedThemes: z.array(compactText).max(24).default([]),
});

export const geminiRecommendationSchema = z.object({
  profileTags: z.array(compactText).max(24).default([]),
  summary: longText.default(""),
  sessionScores: z.array(geminiScoreSchema).max(300),
});

export const recommendationItemSchema = agendaSessionSchema.extend({
  score: z.number().finite().min(0).max(120),
  reason: mediumText,
  note: mediumText,
  matchedThemes: z.array(compactText).max(24),
});

export const scheduledSessionSchema = recommendationItemSchema.extend({
  moveFromPrevious: z.object({
    fromStage: compactText,
    minutes: z.number().int().min(0).max(24 * 60),
  }).optional(),
});

export const recommendationResultSchema = z.object({
  requestSummary: z.object({
    mode: z.enum(["diagnostic", "freeText"]),
    locale: z.enum(localeIds).default("ja"),
    topics: z.array(compactText).max(24),
    role: compactText.optional(),
    goals: z.array(compactText).max(24),
    days: z.array(compactText).max(dayIds.length),
    language: compactText,
    density: compactText,
    generatedAt: z.string().max(80),
  }),
  agendaUpdatedAt: z.string().max(80),
  model: z.object({
    name: compactText,
    source: z.enum(["gemini", "local-fallback"]),
    latencyMs: z.number().finite().min(0).max(300_000),
  }),
  profileTags: z.array(compactText).max(24),
  summary: longText,
  route: z.array(scheduledSessionSchema).max(20),
  recommendations: z.array(recommendationItemSchema).max(30),
  alternatives: z.array(recommendationItemSchema.extend({
    conflictWith: mediumText.optional(),
  })).max(20),
  notes: z.array(mediumText).max(10),
});

export type AgendaSession = z.infer<typeof agendaSessionSchema>;
export type AgendaData = z.infer<typeof agendaDataSchema>;
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type GeminiRecommendation = z.infer<typeof geminiRecommendationSchema>;
export type GeminiScore = z.infer<typeof geminiScoreSchema>;
export type RecommendationItem = z.infer<typeof recommendationItemSchema>;
export type ScheduledSession = z.infer<typeof scheduledSessionSchema>;
export type RecommendationResult = z.infer<typeof recommendationResultSchema>;
