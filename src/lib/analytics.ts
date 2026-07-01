import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  RecommendationResult,
  RecommendRequest,
  SideEventRecommendationResult,
  SideEventRecommendRequest,
} from "./types";

export type AnalyticsEntry = {
  timestamp: string;
  page: "sessions" | "side-events";
  mode: RecommendRequest["mode"];
  topics: string[];
  role?: string;
  goals: string[];
  days: string[];
  language: string;
  density: string;
  recommendedSessionIds?: string[];
  recommendedSideEventIds?: string[];
  modelSource: RecommendationResult["model"]["source"];
  modelLatencyMs: number;
};

export function buildAnalyticsEntry(request: RecommendRequest, result: RecommendationResult): AnalyticsEntry {
  return {
    timestamp: new Date().toISOString(),
    page: "sessions",
    mode: request.mode,
    topics: request.mode === "diagnostic" ? request.diagnostic?.topics ?? [] : result.profileTags,
    role: request.mode === "diagnostic" ? request.diagnostic?.role : undefined,
    goals: request.mode === "diagnostic" ? request.diagnostic?.goals ?? [] : [],
    days: request.basics.days,
    language: request.basics.language,
    density: request.basics.density,
    recommendedSessionIds: result.route.map((session) => session.id),
    modelSource: result.model.source,
    modelLatencyMs: result.model.latencyMs,
  };
}

export function buildSideEventAnalyticsEntry(
  request: SideEventRecommendRequest,
  result: SideEventRecommendationResult,
): AnalyticsEntry {
  return {
    timestamp: new Date().toISOString(),
    page: "side-events",
    mode: request.mode,
    topics: request.mode === "diagnostic" ? request.diagnostic?.topics ?? [] : result.profileTags,
    role: request.mode === "diagnostic" ? request.diagnostic?.role : undefined,
    goals: request.mode === "diagnostic" ? request.diagnostic?.goals ?? [] : [],
    days: request.basics.days,
    language: request.basics.language,
    density: request.basics.density,
    recommendedSideEventIds: result.route.map((event) => event.id),
    modelSource: result.model.source,
    modelLatencyMs: result.model.latencyMs,
  };
}

export async function writeAnalytics(request: RecommendRequest, result: RecommendationResult): Promise<void> {
  const target = process.env.ANALYTICS_PATH || path.join(process.cwd(), "storage", "analytics.ndjson");
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });
  const entry = buildAnalyticsEntry(request, result);
  await appendFile(target, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function writeSideEventAnalytics(
  request: SideEventRecommendRequest,
  result: SideEventRecommendationResult,
): Promise<void> {
  const target = process.env.ANALYTICS_PATH || path.join(process.cwd(), "storage", "analytics.ndjson");
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });
  const entry = buildSideEventAnalyticsEntry(request, result);
  await appendFile(target, `${JSON.stringify(entry)}\n`, "utf8");
}
