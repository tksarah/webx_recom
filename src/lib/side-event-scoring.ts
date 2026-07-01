import { TOPIC_OPTIONS } from "./constants";
import { SideEvent, SideEventGeminiRecommendation, SideEventRecommendRequest } from "./types";

type KeywordMap = Record<string, string[]>;
type Locale = SideEventRecommendRequest["locale"];

const topicKeywords: KeywordMap = {
  stablecoin: ["stablecoin", "stablecoins", "payment", "payments", "jpyc", "ステーブルコイン", "決済", "送金"],
  rwa: ["rwa", "tokenized", "tokenization", "treasury", "real-world asset", "トークン化", "デジタルアセット"],
  ai: ["ai", "agent", "agents", "agentic", "auton", "autonomous", "人工知能"],
  regulation: ["regulation", "regulatory", "compliance", "law", "policy", "規制", "コンプライアンス", "政策"],
  bitcoin: ["bitcoin", "btc", "treasury", "ビットコイン"],
  defi: ["defi", "liquidity", "on-chain", "onchain", "decentralized finance", "分散型金融"],
  security: ["security", "wallet", "custody", "mpc", "fraud", "セキュリティ", "カストディ"],
  enterprise: ["enterprise", "institutional", "corporate", "executive", "leadership", "企業", "機関投資家"],
  payments: ["payment", "payments", "remittance", "wallet", "決済", "送金"],
  infrastructure: ["infrastructure", "blockchain", "protocol", "layer", "wallet", "chain", "インフラ"],
  investment: ["vc", "venture", "capital", "investor", "investment", "otc", "market maker", "投資", "投資家"],
  policy: ["government", "policy", "public", "regulatory", "digital economy", "政府", "公共", "政策"],
};

const roleKeywords: KeywordMap = {
  business: ["business", "partnership", "executive", "networking", "leadership", "企業", "事業", "提携"],
  investor: ["vc", "investor", "capital", "fund", "otc", "market", "投資", "投資家"],
  developer: ["builder", "developer", "engineer", "protocol", "hack", "ai", "開発", "エンジニア"],
  policy: ["policy", "regulation", "government", "law", "compliance", "規制", "政策"],
  media: ["forum", "discussion", "leadership", "market", "story", "メディア"],
  student: ["intro", "learn", "builder", "community", "meetup", "learning", "学習"],
};

const goalKeywords: KeywordMap = {
  market_trends: ["forum", "discussion", "market", "trends", "leadership", "ecosystem", "市場", "動向"],
  partnerships: ["networking", "meetup", "dinner", "social", "connect", "partnership", "交流", "懇親"],
  technical_learning: ["developer", "builder", "protocol", "infrastructure", "pitch", "technical", "開発"],
  regulatory_signal: ["policy", "regulation", "compliance", "digital economy", "規制", "政策"],
  investment_signal: ["vc", "investor", "capital", "otc", "deal", "treasury", "投資"],
  speaker_priority: ["executive", "leadership", "vip", "founder", "speaker", "代表"],
};

export function buildFallbackSideEventRecommendation(
  request: SideEventRecommendRequest,
  events: SideEvent[],
): SideEventGeminiRecommendation {
  const profileTags = request.mode === "diagnostic"
    ? [...(request.diagnostic?.topics ?? []), request.diagnostic?.role ?? "", ...(request.diagnostic?.goals ?? [])].filter(Boolean)
    : inferTagsFromFreeText(request.freeText ?? "");

  const eventScores = events.map((event) => {
    const score = scoreSideEventHeuristically(event, request, profileTags);
    return {
      eventId: event.id,
      score,
      reason: buildFallbackReason(event, profileTags, score, request.locale),
      note: buildFallbackNote(event, request.locale),
      matchedThemes: matchedThemes(event, profileTags),
    };
  });

  return {
    profileTags,
    summary: copy(request.locale).summary,
    eventScores,
  };
}

function scoreSideEventHeuristically(event: SideEvent, request: SideEventRecommendRequest, tags: string[]): number {
  const haystack = eventHaystack(event);
  let score = 34;

  for (const tag of tags) {
    const keywords = topicKeywords[tag] ?? roleKeywords[tag] ?? goalKeywords[tag] ?? [tag];
    if (event.tags.includes(tag) || keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      score += 13;
    }
  }

  if (request.mode === "diagnostic") {
    const role = request.diagnostic?.role;
    if (role && (roleKeywords[role] ?? []).some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      score += 10;
    }
    for (const goal of request.diagnostic?.goals ?? []) {
      if ((goalKeywords[goal] ?? []).some((keyword) => haystack.includes(keyword.toLowerCase()))) {
        score += 7;
      }
    }
  }

  if (request.mode === "freeText" && request.freeText) {
    const words = tokenize(request.freeText);
    score += Math.min(20, words.filter((word) => haystack.includes(word)).length * 4);
  }

  if (event.registration.approvalRequired) {
    score -= 5;
  }
  if (event.registration.free) {
    score += 3;
  }
  if (event.description.length > 120) {
    score += 3;
  }
  if (event.isOfficial) {
    score += 4;
  }

  return Math.max(0, Math.min(96, score));
}

function buildFallbackReason(event: SideEvent, tags: string[], score: number, locale: Locale): string {
  const text = copy(locale);
  const matched = matchedThemes(event, tags);
  if (matched.length > 0) {
    return text.matchedReason(formatTags(matched, locale));
  }
  if (score >= 60) {
    return text.closeReason;
  }
  return text.alternativeReason;
}

function buildFallbackNote(event: SideEvent, locale: Locale): string {
  const notes: string[] = [];
  if (event.registration.approvalRequired) {
    notes.push(locale === "en" ? "Approval may be required." : "参加には承認が必要な可能性があります。");
  }
  if (event.registration.free) {
    notes.push(locale === "en" ? "Listed as free." : "無料イベントとして掲載されています。");
  }
  return notes.join(" ");
}

function matchedThemes(event: SideEvent, tags: string[]): string[] {
  const haystack = eventHaystack(event);
  return tags.filter((tag) => {
    const keywords = topicKeywords[tag] ?? roleKeywords[tag] ?? goalKeywords[tag] ?? [tag];
    return event.tags.includes(tag) || keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });
}

function inferTagsFromFreeText(text: string): string[] {
  const lower = text.toLowerCase();
  const inferred = TOPIC_OPTIONS
    .filter((topic) => {
      const keywords = topicKeywords[topic.id] ?? [topic.id];
      return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
    })
    .map((topic) => topic.id);

  return inferred.length > 0 ? inferred : ["partnerships", "market_trends"];
}

function eventHaystack(event: SideEvent): string {
  return [
    event.title,
    event.description,
    event.rawText,
    event.tags.join(" "),
    event.organizers.join(" "),
    event.venueName,
    event.address,
  ].join(" ").toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 24);
}

function formatTags(tags: string[], locale: Locale): string {
  return tags
    .slice(0, 3)
    .map((tag) => {
      const topic = TOPIC_OPTIONS.find((item) => item.id === tag);
      return locale === "en" ? topic?.labelEn ?? tag : topic?.label ?? tag;
    })
    .join(" / ");
}

function copy(locale: Locale) {
  if (locale === "en") {
    return {
      summary: "A provisional side-event route was created with local scoring from your inputs and the Luma event details.",
      matchedReason: (tags: string) => `This event strongly matches ${tags} and should be useful for the stated goal.`,
      closeReason: "This event is close to your stated goal and looks like a useful networking stop.",
      alternativeReason: "This is useful as a comparison option when reviewing events around the same time.",
    };
  }

  return {
    summary: "入力内容とLumaのイベント詳細をもとに、ローカル評価で暫定のサイドイベントルートを作成しました。",
    matchedReason: (tags: string) => `${tags}との関連が強く、目的に合いやすいサイドイベントです。`,
    closeReason: "入力された目的に近く、ネットワーキング先として有用な候補です。",
    alternativeReason: "同じ時間帯の候補を比較するときに役立つサイドイベントです。",
  };
}
