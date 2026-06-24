type Locale = "ja" | "en";

type RateLimitOptions = {
  namespace: string;
  maxRequests: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const rateLimitBuckets = new Map<string, RateLimitBucket>();
let lastRateLimitCleanup = 0;

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: "invalid_json" | "payload_too_large" | "unsupported_media_type",
  ) {
    super(code);
  }
}

export function checkRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupRateLimitBuckets(now, options.windowMs);

  const key = `${options.namespace}:${clientIp(request)}`;
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { allowed: true };
  }

  if (current.count >= options.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true };
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiRequestError(415, "unsupported_media_type");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number(contentLength);
    if (!Number.isFinite(length) || length < 0) {
      throw new ApiRequestError(400, "invalid_json");
    }
    if (length > maxBytes) {
      throw new ApiRequestError(413, "payload_too_large");
    }
  }

  if (!request.body) {
    throw new ApiRequestError(400, "invalid_json");
  }

  const chunks: Uint8Array[] = [];
  const reader = request.body.getReader();
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new ApiRequestError(413, "payload_too_large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new ApiRequestError(400, "invalid_json");
  }
}

export function apiErrorMessage(error: ApiRequestError, locale: Locale): string {
  const messages = {
    ja: {
      invalid_json: "JSONの内容を確認してください",
      payload_too_large: "リクエストが大きすぎます",
      unsupported_media_type: "Content-Typeはapplication/jsonで送信してください",
    },
    en: {
      invalid_json: "Please check the JSON body.",
      payload_too_large: "The request body is too large.",
      unsupported_media_type: "Please send Content-Type: application/json.",
    },
  } as const;

  return messages[locale][error.code];
}

export function rateLimitMessage(locale: Locale): string {
  return locale === "en"
    ? "Too many requests. Please wait a moment and try again."
    : "リクエストが集中しています。少し待ってから再度お試しください。";
}

export function requestLocaleFromHeaders(request: Request): Locale {
  return request.headers.get("accept-language")?.toLowerCase().startsWith("en") ? "en" : "ja";
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) {
    return forwardedFor;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function cleanupRateLimitBuckets(now: number, windowMs: number): void {
  if (now - lastRateLimitCleanup < windowMs && rateLimitBuckets.size < 5000) {
    return;
  }

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
  lastRateLimitCleanup = now;
}
