import "server-only";
import { AI_DEFAULT_MODEL, AI_MAX_OUTPUT_TOKENS } from "./limits";
import type { ModelMessage } from "./prompt";
import type { AI_TOOLS } from "./tools";

const CHAT_COMPLETIONS_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export class GeminiError extends Error {
  constructor(readonly status: number) {
    super(`Gemini request failed with status ${status}`);
  }
}

// Gemini의 OpenAI 호환 Chat Completions 스트리밍 요청을 보내고, 성공한 응답(본문 스트림)을 돌려준다.
// tools를 생략하면 모델은 도구 없이 답해야 한다.
// 실패 시 Gemini가 준 본문은 사용자에게 보이지 않도록 상태 코드만 담아 던진다.
export async function openChatStream(params: {
  apiKey: string;
  messages: ModelMessage[];
  tools?: typeof AI_TOOLS;
  signal: AbortSignal;
}): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    signal: params.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL || AI_DEFAULT_MODEL,
      messages: params.messages,
      stream: true,
      max_completion_tokens: AI_MAX_OUTPUT_TOKENS,
      ...(params.tools ? { tools: params.tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new GeminiError(response.status);
  }
  return response.body;
}
