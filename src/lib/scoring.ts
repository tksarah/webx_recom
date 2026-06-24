import { TOPIC_OPTIONS } from "./constants";
import { AgendaSession, GeminiRecommendation, RecommendRequest } from "./types";

type KeywordMap = Record<string, string[]>;
type Locale = RecommendRequest["locale"];

const topicKeywords: KeywordMap = {
  stablecoin: ["stablecoin", "stablecoins", "deposit", "payments", "money movement", "jpyc", "digital currency", "決済", "送金", "ステーブル"],
  rwa: ["rwa", "tokenized", "tokenization", "securities", "mmf", "bond", "asset", "on-chain asset", "証券", "トークン化", "現実資産"],
  ai: ["ai", "agent", "agents", "autonomous", "perplexity", "agentic", "人工知能", "エージェント"],
  regulation: ["regulation", "regulatory", "fiea", "policy", "compliance", "law", "regime", "規制", "金融商品取引法", "法務"],
  bitcoin: ["bitcoin", "btc", "treasury", "metaplanet", "ビットコイン"],
  defi: ["defi", "liquidity", "on-chain product", "compliant defi", "流動性"],
  security: ["security", "cybersecurity", "private key", "quantum", "tracing", "misuse", "fraud", "crime", "サイバー", "不正", "鍵"],
  enterprise: ["enterprise", "institutional", "corporate", "bank", "finance", "financial infrastructure", "megabanks", "企業", "銀行", "金融機関"],
  payments: ["payment", "payments", "remittance", "retail", "card", "visa", "mastercard", "決済", "送金"],
  infrastructure: ["infrastructure", "blockchain", "stack", "protocol", "network", "wallet", "custody", "基盤", "ウォレット"],
  investment: ["vc", "fund", "capital", "market", "price", "macro", "liquidity", "a16z", "pantera", "投資", "市場", "資金"],
  policy: ["government", "policy", "public", "municipal", "national", "japan", "regulatory", "政府", "行政", "公共"],
};

const roleKeywords: KeywordMap = {
  business: ["corporate", "enterprise", "payments", "finance", "business", "market", "事業", "提携"],
  investor: ["market", "investment", "capital", "liquidity", "vc", "fund", "price", "macro", "投資"],
  developer: ["infrastructure", "stack", "protocol", "wallet", "security", "blockchain", "ai", "技術", "開発"],
  policy: ["policy", "government", "regulation", "regulatory", "law", "public", "規制", "政策", "法務"],
  media: ["fireside", "special", "market", "future", "outlook", "注目", "未来"],
  student: ["future", "introduction", "overview", "trend", "technology", "入門", "概観", "学習"],
};

export function buildFallbackRecommendation(
  request: RecommendRequest,
  sessions: AgendaSession[],
): GeminiRecommendation {
  const profileTags = request.mode === "diagnostic"
    ? [...(request.diagnostic?.topics ?? []), request.diagnostic?.role ?? "", ...(request.diagnostic?.goals ?? [])].filter(Boolean)
    : inferTagsFromFreeText(request.freeText ?? "");

  const sessionScores = sessions.map((session) => {
    const score = scoreSessionHeuristically(session, request, profileTags);
    return {
      sessionId: session.id,
      score,
      reason: buildFallbackReason(session, profileTags, score, request.locale),
      note: session.isPlaceholder ? copy(request.locale).placeholderNote : "",
      matchedThemes: matchedThemes(session, profileTags),
    };
  });

  return {
    profileTags,
    summary: copy(request.locale).summary,
    sessionScores,
  };
}

function scoreSessionHeuristically(session: AgendaSession, request: RecommendRequest, tags: string[]): number {
  const haystack = `${session.title} ${session.rawText} ${session.categories.join(" ")} ${session.speakers.join(" ")}`.toLowerCase();
  let score = session.isPlaceholder ? 18 : 34;

  for (const tag of tags) {
    const keywords = topicKeywords[tag] ?? roleKeywords[tag] ?? [tag];
    if (keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      score += 13;
    }
  }

  if (request.mode === "diagnostic") {
    const role = request.diagnostic?.role;
    if (role && (roleKeywords[role] ?? []).some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      score += 10;
    }
    if (request.diagnostic?.goals.includes("speaker_priority") && session.speakers.length > 0) {
      score += 5;
    }
  }

  if (request.mode === "freeText" && request.freeText) {
    const words = tokenize(request.freeText);
    score += Math.min(18, words.filter((word) => haystack.includes(word)).length * 4);
  }

  return Math.max(0, Math.min(session.isPlaceholder ? 30 : 96, score));
}

function buildFallbackReason(session: AgendaSession, tags: string[], score: number, locale: Locale): string {
  const text = copy(locale);
  if (session.isPlaceholder) {
    return text.placeholderReason;
  }

  const matched = matchedThemes(session, tags);
  if (matched.length > 0) {
    return text.matchedReason(formatTags(matched, locale));
  }

  if (score >= 60) {
    return text.closeReason;
  }

  return text.alternativeReason;
}

function matchedThemes(session: AgendaSession, tags: string[]): string[] {
  const haystack = `${session.title} ${session.rawText}`.toLowerCase();
  return tags.filter((tag) => {
    const keywords = topicKeywords[tag] ?? roleKeywords[tag] ?? [tag];
    return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
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

  return inferred.length > 0 ? inferred : ["market_trends"];
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
      summary: "A provisional route was created with local scoring from your inputs and the session titles.",
      placeholderNote: "Details are not published yet. Please recheck once the official agenda is updated.",
      placeholderReason: "Details are not published yet, so this is kept as a low-priority time-slot option.",
      matchedReason: (tags: string) => `This session has a strong connection to ${tags} and fits the stated goal well.`,
      closeReason: "This session includes themes close to your stated goal, so it is prioritized as a useful option.",
      alternativeReason: "This is useful as a comparison option when reviewing sessions that fit the same time slot.",
    };
  }

  return {
    summary: "入力内容とセッションタイトルをもとに、ローカル評価で暫定ルートを作成しました。",
    placeholderNote: "詳細未公開のため、内容確定後に再確認してください。",
    placeholderReason: "詳細未公開ですが、時間帯の候補として低優先度で残しています。",
    matchedReason: (tags: string) => `${tags}との関連が強く、目的に合いやすいセッションです。`,
    closeReason: "入力された目的と近いテーマを含むため、優先候補にしました。",
    alternativeReason: "時間割上の代替候補として比較しやすいセッションです。",
  };
}
