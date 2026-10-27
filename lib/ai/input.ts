import { hasLocale, type Locale } from "@/lib/i18n/config";
import { AI_MAX_QUESTION_CHARS } from "./limits";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

export type AiRequest = {
  question: string;
  conversationId: string | null;
  lang: Locale; // 답변 언어
};

export type AiRequestResult =
  | { ok: true; value: AiRequest }
  | { ok: false; code: "question" | "invalid" };

// POST /api/ai 본문 검증. 직접 호출될 수 있으므로 타입을 믿지 않는다.
export function parseAiRequest(body: unknown): AiRequestResult {
  if (typeof body !== "object" || body === null) return { ok: false, code: "invalid" };
  const v = body as Record<string, unknown>;
  const lang = v.lang;
  if (typeof v.question !== "string" || typeof lang !== "string" || !hasLocale(lang)) {
    return { ok: false, code: "invalid" };
  }
  if (v.conversationId != null && !isUuid(v.conversationId)) {
    return { ok: false, code: "invalid" };
  }
  const question = v.question.trim();
  if (question.length < 1 || question.length > AI_MAX_QUESTION_CHARS) {
    return { ok: false, code: "question" };
  }
  return {
    ok: true,
    value: {
      question,
      conversationId: (v.conversationId as string | null | undefined) ?? null,
      lang,
    },
  };
}
