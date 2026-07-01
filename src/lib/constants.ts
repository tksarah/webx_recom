export const WEBX_AGENDA_URL = "https://webx-asia.com/agenda/";
export const LUMA_SIDE_EVENTS_URL = "https://luma.com/webx.sideevents";

export const STAGES = [
  "CRYL Stage",
  "Binance Stage",
  "C Stage",
  "Visionary Stage",
  "Seminar",
] as const;

export const EVENT_DAYS = [
  { id: "2026-07-13", label: "7/13", display: "7月13日", displayEn: "Jul 13" },
  { id: "2026-07-14", label: "7/14", display: "7月14日", displayEn: "Jul 14" },
] as const;

export const TOPIC_OPTIONS = [
  {
    id: "stablecoin",
    label: "ステーブルコイン",
    labelEn: "Stablecoins",
    description: "決済・送金・通貨活用",
    descriptionEn: "Payments, transfers, currency use",
  },
  {
    id: "rwa",
    label: "RWA",
    labelEn: "RWA",
    description: "現実資産のトークン化",
    descriptionEn: "Tokenized real-world assets",
  },
  {
    id: "ai",
    label: "AI・エージェント",
    labelEn: "AI & agents",
    description: "AIとWeb3の交差点",
    descriptionEn: "Where AI meets Web3",
  },
  {
    id: "regulation",
    label: "規制・政策",
    labelEn: "Regulation",
    description: "法制度やコンプライアンス",
    descriptionEn: "Law, policy, compliance",
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    labelEn: "Bitcoin",
    description: "BTC市場・財務戦略",
    descriptionEn: "BTC markets and treasury",
  },
  {
    id: "defi",
    label: "DeFi",
    labelEn: "DeFi",
    description: "分散型金融と流動性",
    descriptionEn: "Decentralized finance",
  },
  {
    id: "security",
    label: "セキュリティ",
    labelEn: "Security",
    description: "不正対策・鍵管理・監査",
    descriptionEn: "Fraud, keys, audits",
  },
  {
    id: "enterprise",
    label: "エンタープライズ",
    labelEn: "Enterprise",
    description: "大企業・金融機関の導入",
    descriptionEn: "Corporate adoption",
  },
  {
    id: "payments",
    label: "決済",
    labelEn: "Payments",
    description: "リテール決済や送金",
    descriptionEn: "Retail payments and remits",
  },
  {
    id: "infrastructure",
    label: "インフラ",
    labelEn: "Infrastructure",
    description: "基盤技術・ウォレット",
    descriptionEn: "Protocols, wallets, stack",
  },
  {
    id: "investment",
    label: "投資動向",
    labelEn: "Investment trends",
    description: "市場・VC・資金流入",
    descriptionEn: "Markets, VC, flows",
  },
  {
    id: "policy",
    label: "公共政策",
    labelEn: "Public policy",
    description: "行政・社会実装の視点",
    descriptionEn: "Government and society",
  },
] as const;

export const ROLE_OPTIONS = [
  {
    id: "business",
    label: "事業開発",
    labelEn: "Business development",
    description: "新規事業や提携を探したい",
    descriptionEn: "Find partners and opportunities",
  },
  {
    id: "investor",
    label: "投資家",
    labelEn: "Investor",
    description: "市場や投資先を見たい",
    descriptionEn: "Read markets and targets",
  },
  {
    id: "developer",
    label: "開発者",
    labelEn: "Developer",
    description: "技術や実装を深掘り",
    descriptionEn: "Go deeper on technology",
  },
  {
    id: "policy",
    label: "政策・法務",
    labelEn: "Policy / legal",
    description: "規制や制度設計を確認",
    descriptionEn: "Track rules and policy",
  },
  {
    id: "media",
    label: "メディア",
    labelEn: "Media",
    description: "注目テーマを取材する",
    descriptionEn: "Find strong story angles",
  },
  {
    id: "student",
    label: "学生・学習目的",
    labelEn: "Student / learning",
    description: "全体像を学びたい",
    descriptionEn: "Build a broad overview",
  },
] as const;

export const GOAL_OPTIONS = [
  {
    id: "market_trends",
    label: "市場トレンドを掴む",
    labelEn: "Understand market trends",
    description: "今の論点を広く把握",
    descriptionEn: "Map current discussion",
  },
  {
    id: "partnerships",
    label: "提携先を探す",
    labelEn: "Find partners",
    description: "協業候補や導入事例",
    descriptionEn: "Spot collaboration leads",
  },
  {
    id: "technical_learning",
    label: "技術理解を深める",
    labelEn: "Deepen technical knowledge",
    description: "仕組みや実装を学ぶ",
    descriptionEn: "Learn systems and builds",
  },
  {
    id: "regulatory_signal",
    label: "規制動向を知る",
    labelEn: "Track regulation",
    description: "政策・法務の変化を見る",
    descriptionEn: "Watch legal changes",
  },
  {
    id: "investment_signal",
    label: "投資判断に使う",
    labelEn: "Support investment decisions",
    description: "市場材料を集める",
    descriptionEn: "Gather market signals",
  },
  {
    id: "speaker_priority",
    label: "登壇者優先",
    labelEn: "Prioritize speakers",
    description: "会いたい人・聞きたい人",
    descriptionEn: "Favor notable speakers",
  },
] as const;

export const LANGUAGE_OPTIONS = [
  { id: "both", label: "JA / EN", labelEn: "JA / EN" },
  { id: "ja", label: "日本語", labelEn: "Japanese" },
  { id: "en", label: "英語", labelEn: "English" },
] as const;

export const DENSITY_OPTIONS = [
  {
    id: "balanced",
    label: "バランス型",
    labelEn: "Balanced",
    description: "重要候補を無理なく回る",
    descriptionEn: "Prioritize without rushing",
  },
  {
    id: "relaxed",
    label: "ゆったり型",
    labelEn: "Relaxed",
    description: "移動と休憩を多めに取る",
    descriptionEn: "Leave more buffer time",
  },
  {
    id: "packed",
    label: "詰め込み型",
    labelEn: "Packed",
    description: "できるだけ多く聴く",
    descriptionEn: "Attend as much as possible",
  },
] as const;

export const DEFAULT_MOVE_BUFFER_MINUTES = 5;
