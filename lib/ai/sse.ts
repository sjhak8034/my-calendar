// Gemini(OpenAI 호환) 스트리밍(SSE) 응답 조각을 줄 단위로 이어 붙여 data 값을 꺼낸다.
// 네트워크 청크는 줄 중간에서 끊길 수 있으므로 남은 부분(rest)을 다음 청크 앞에 붙인다.
export function feedSse(
  rest: string,
  chunk: string,
): { data: string[]; rest: string } {
  const lines = (rest + chunk).split(/\r?\n/);
  const nextRest = lines.pop() ?? "";
  const data: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  return { data, rest: nextRest };
}

// 스트림으로 조금씩 오는 도구 호출 한 조각. 같은 호출의 조각은 index 또는 id로 이어 붙인다.
export type ToolCallPart = {
  index?: number;
  id?: string;
  name?: string;
  args?: string;
  extra?: unknown; // Gemini가 붙이는 extra_content(thought signature). 다음 요청에 그대로 돌려줘야 한다.
};

export type ChatDelta =
  | { kind: "text"; text: string }
  | { kind: "tool"; parts: ToolCallPart[] }
  | { kind: "finish"; reason: string }
  | { kind: "done" };

// data 한 줄(JSON 또는 [DONE])을 해석한다. 모르는 모양은 무시한다.
export function parseChatData(data: string): ChatDelta[] {
  if (data === "[DONE]") return [{ kind: "done" }];
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return [];
  }
  const choices = (json as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || typeof choices[0] !== "object" || choices[0] === null) {
    return [];
  }
  const first = choices[0] as {
    delta?: { content?: unknown; tool_calls?: unknown };
    finish_reason?: unknown;
  };
  const out: ChatDelta[] = [];
  const text = first.delta?.content;
  if (typeof text === "string" && text.length > 0) out.push({ kind: "text", text });

  const calls = first.delta?.tool_calls;
  if (Array.isArray(calls)) {
    const parts: ToolCallPart[] = [];
    for (const raw of calls) {
      if (typeof raw !== "object" || raw === null) continue;
      const c = raw as {
        index?: unknown;
        id?: unknown;
        function?: { name?: unknown; arguments?: unknown };
        extra_content?: unknown;
      };
      parts.push({
        index: typeof c.index === "number" ? c.index : undefined,
        id: typeof c.id === "string" && c.id ? c.id : undefined,
        name: typeof c.function?.name === "string" ? c.function.name : undefined,
        args: typeof c.function?.arguments === "string" ? c.function.arguments : undefined,
        extra: c.extra_content,
      });
    }
    if (parts.length > 0) out.push({ kind: "tool", parts });
  }

  if (typeof first.finish_reason === "string") {
    out.push({ kind: "finish", reason: first.finish_reason });
  }
  return out;
}

export type AssembledToolCall = {
  id: string;
  name: string;
  arguments: string;
  extra?: unknown;
};

// 도구 호출 조각을 호출 단위로 모은다. 새 id가 오거나(같은 index가 재사용되는 경우 포함)
// 이름이 새로 오면 새 호출이고, 그 외 조각은 가장 최근 호출에 이어 붙인다.
export class ToolCallAssembler {
  private calls: AssembledToolCall[] = [];
  private byIndex = new Map<number, AssembledToolCall>();

  push(part: ToolCallPart): void {
    let call: AssembledToolCall | undefined;
    if (part.id !== undefined) {
      call = this.calls.find((c) => c.id === part.id);
    } else if (part.index !== undefined) {
      call = this.byIndex.get(part.index);
    } else if (part.name === undefined) {
      call = this.calls[this.calls.length - 1];
    }
    if (!call) {
      call = { id: part.id ?? `call_${this.calls.length}`, name: "", arguments: "" };
      this.calls.push(call);
    }
    if (part.index !== undefined) this.byIndex.set(part.index, call);
    if (part.name) call.name += part.name;
    if (part.args) call.arguments += part.args;
    if (part.extra !== undefined) call.extra = part.extra;
  }

  get result(): AssembledToolCall[] {
    return this.calls.filter((c) => c.name);
  }
}
