import { after } from "next/server";
import { todayInSeoul } from "@/lib/calendar";
import { parseAiRequest } from "@/lib/ai/input";
import {
  AI_DAILY_LIMIT,
  AI_DEFAULT_MODEL,
  AI_GUEST_LIMIT,
  AI_HOURLY_LIMIT,
  AI_HISTORY_MESSAGES,
  AI_MAX_DRAFTS,
  AI_MAX_TOOL_ROUNDS,
} from "@/lib/ai/limits";
import { GeminiError, openChatStream } from "@/lib/ai/gemini";
import { buildMessages, systemPrompt, type ChatMessage, type ModelMessage } from "@/lib/ai/prompt";
import { ToolCallAssembler, feedSse, parseChatData } from "@/lib/ai/sse";
import { AI_TOOLS, runTool } from "@/lib/ai/tools";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/require-user";

type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "question"
  | "notFound"
  | "rateLimited"
  | "guestLimited"
  | "notConfigured"
  | "upstream"
  | "failed";

// 사용자가 카드에서 확인해야 실행되는 변경 도구(질문당 개수 상한을 함께 센다)
const DRAFT_TOOLS = new Set(["create_event", "update_event", "delete_event"]);
const BASE_HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const MAX_BODY_CHARS = 2000;

function fail(status: number, code: ErrorCode) {
  return Response.json({ code }, { status, headers: BASE_HEADERS });
}

// 본인 사이트에서 보낸 요청인지(CSRF 방어). Server Action과 달리 Route Handler는 자동 검사가 없다.
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// POST /api/ai: 질문에 답하며 필요하면 도구(일정 검색)를 불러 본인 일정을 읽고, Gemini 답변을 스트리밍한다(NDJSON).
// 한 줄 = {"t":"meta"|"tool"|"draft"|"delta"|"error"|"done", ...}. 대화와 답변은 DB에 저장한다(마지막 대화 후 30일 보관).
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "forbidden");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return fail(415, "invalid");
  }

  const session = await requireUser();
  if (!session) return fail(401, "unauthorized");
  const { supabase, user } = session;
  const isGuest = user.is_anonymous === true;

  let parsed;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return fail(413, "invalid");
    parsed = parseAiRequest(JSON.parse(text));
  } catch {
    return fail(400, "invalid");
  }
  if (!parsed.ok) return fail(400, parsed.code);
  const { question, conversationId, lang } = parsed.value;

  // API 키는 서버 환경변수에만 둔다. 없으면 한도를 쓰기 전에 알린다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail(503, "notConfigured");

  // 기존 대화면 본인 대화인지 확인한다(RLS가 남의 대화를 걸러 낸다).
  if (conversationId) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (error) {
      console.error("[ai] conversation lookup failed:", error.message);
      return fail(500, "failed");
    }
    if (!data) return fail(404, "notFound");
  }

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    p_hour_limit: isGuest ? AI_GUEST_LIMIT : AI_HOURLY_LIMIT,
    p_day_limit: isGuest ? AI_GUEST_LIMIT : AI_DAILY_LIMIT,
  });
  if (quotaError) {
    console.error("[ai] consume_ai_quota failed:", quotaError.message);
    return fail(500, "failed");
  }
  if (!allowed) return fail(429, isGuest ? "guestLimited" : "rateLimited");

  // 이어 질문이면 이전 대화를 맥락으로 쓴다(새 질문 저장 전에 읽는다).
  let history: ChatMessage[] = [];
  if (conversationId) {
    const { data, error } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(AI_HISTORY_MESSAGES);
    if (error) {
      console.error("[ai] history load failed:", error.message);
      return fail(500, "failed");
    }
    history = (data as ChatMessage[]).reverse();
  }

  const messages: ModelMessage[] = buildMessages({
    system: systemPrompt({ today: todayInSeoul(new Date()), lang }),
    history,
    question,
  });

  // 클라이언트가 중단하면 Gemini 호출도 끊어 비용을 막는다.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  // 첫 모델 호출이 실패하면 아무것도 저장하지 않고 끝내도록, 저장 전에 먼저 연다.
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await openChatStream({ apiKey, messages, tools: AI_TOOLS, signal: abort.signal });
  } catch (error) {
    if (abort.signal.aborted) return fail(499, "failed");
    // 상태 코드만 남긴다(키·응답 본문은 기록하지 않는다).
    console.error("[ai] upstream failed:", error instanceof GeminiError ? error.status : "network");
    return fail(502, "upstream");
  }

  // 답변이 시작되기 전에 대화와 질문을 저장한다.
  let id = conversationId;
  if (!id) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ title: Array.from(question).slice(0, 100).join("") })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[ai] conversation insert failed:", error?.message);
      abort.abort();
      return fail(500, "failed");
    }
    id = data.id as string;
  }
  const savedConversationId = id;
  const { error: questionError } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: savedConversationId, role: "user", content: question });
  if (questionError) {
    console.error("[ai] question insert failed:", questionError.message);
    abort.abort();
    return fail(500, "failed");
  }

  const encoder = new TextEncoder();
  let answer = "";
  let finish = "stop";
  // 질문 1건 동안의 모델 호출 수와 토큰 합계(비용 확인용 로그). usageRounds가 rounds보다 작으면 일부 호출의 사용량이 오지 않은 것이다.
  const tally = { rounds: 0, usageRounds: 0, prompt: 0, completion: 0, reasoning: 0, total: 0 };
  let finished!: () => void;
  const streamEnded = new Promise<void>((resolve) => (finished = resolve));

  // 질문 1건의 토큰 사용량을 비용 확인용으로 저장한다(숫자만, 서버만 쓸 수 있는 표). 실패해도 답변에는 영향이 없다.
  async function recordUsage() {
    if (tally.rounds === 0) return;
    const admin = createAdminClient();
    if (!admin) return;
    const { error } = await admin.from("ai_usage").insert({
      user_id: user.id,
      is_guest: isGuest,
      model: process.env.GEMINI_MODEL || AI_DEFAULT_MODEL,
      rounds: tally.rounds,
      usage_rounds: tally.usageRounds,
      prompt_tokens: tally.prompt,
      completion_tokens: tally.completion,
      reasoning_tokens: tally.reasoning,
      total_tokens: tally.total,
    });
    if (error) {
      console.error("[ai] usage insert failed:", error.code ?? "unknown");
      return;
    }
    // 오래된 기록을 조금씩 지운다(90일).
    await admin.rpc("purge_old_ai_usage", { p_batch: 100 });
  }

  // 사용자가 중단하거나 탭을 닫아도 받은 만큼의 답변은 저장한다(서버리스 수명은 after로 연장).
  after(async () => {
    await streamEnded;
    await recordUsage();
    if (!answer) return;
    const { error } = await supabase
      .from("ai_messages")
      .insert({ conversation_id: savedConversationId, role: "assistant", content: answer });
    if (error) console.error("[ai] answer insert failed:", error.message);
  });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));

      // 모델 응답 한 번을 끝까지 읽는다. 글자는 바로 화면으로 보내고, 도구 호출은 모아서 돌려준다.
      async function readRound(stream: ReadableStream<Uint8Array>) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        const assembler = new ToolCallAssembler();
        let text = "";
        let rest = "";
        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          const fed = feedSse(rest, decoder.decode(value, { stream: true }));
          rest = fed.rest;
          for (const data of fed.data) {
            for (const delta of parseChatData(data)) {
              if (delta.kind === "text") {
                text += delta.text;
                answer += delta.text;
                send({ t: "delta", v: delta.text });
              } else if (delta.kind === "tool") {
                for (const part of delta.parts) assembler.push(part);
              } else if (delta.kind === "finish") {
                finish = delta.reason;
              } else if (delta.kind === "usage") {
                tally.usageRounds += 1;
                tally.prompt += delta.usage.prompt;
                tally.completion += delta.usage.completion;
                tally.reasoning += delta.usage.reasoning;
                tally.total += delta.usage.total;
              } else {
                done = true;
              }
            }
          }
        }
        return { text, calls: assembler.result };
      }

      try {
        send({ t: "meta", conversationId: savedConversationId });
        let stream = upstream;
        let drafts = 0;
        for (let round = 1; ; round++) {
          tally.rounds += 1;
          const { text, calls } = await readRound(stream);
          if (calls.length === 0) break;

          // 모델이 도구를 불렀다. 실행 결과를 붙여 다시 묻는다. 마지막 라운드는 도구 없이 답하게 한다.
          messages.push({
            role: "assistant",
            content: text || null,
            tool_calls: calls.map((c) => ({
              id: c.id,
              type: "function" as const,
              function: { name: c.name, arguments: c.arguments },
              ...(c.extra !== undefined ? { extra_content: c.extra } : {}),
            })),
          });
          for (const call of calls) {
            send({ t: "tool", name: call.name });
            let content: string;
            if (DRAFT_TOOLS.has(call.name) && drafts >= AI_MAX_DRAFTS) {
              content = JSON.stringify({ error: "Too many drafts for one message." });
            } else {
              const result = await runTool(supabase, call.name, call.arguments);
              content = result.content;
              if (result.draft) {
                drafts += 1;
                send({ t: "draft", draft: result.draft });
              }
            }
            messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content });
          }
          if (answer && !answer.endsWith("\n")) {
            answer += "\n";
            send({ t: "delta", v: "\n" });
          }
          stream = await openChatStream({
            apiKey,
            messages,
            tools: round < AI_MAX_TOOL_ROUNDS ? AI_TOOLS : undefined,
            signal: abort.signal,
          });
        }
        send({ t: "done", finish });
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error(
            "[ai] stream failed:",
            error instanceof GeminiError ? error.status : "network",
          );
          try {
            send({ t: "error", code: "upstream" });
          } catch {}
        }
      } finally {
        // 토큰 수와 호출 수만 남긴다(질문·답변·사용자 식별 정보는 남기지 않는다).
        console.info("[ai] usage", JSON.stringify({ model: process.env.GEMINI_MODEL || AI_DEFAULT_MODEL, ...tally }));
        try {
          controller.close();
        } catch {}
        finished();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body, {
    headers: { ...BASE_HEADERS, "content-type": "application/x-ndjson; charset=utf-8" },
  });
}
