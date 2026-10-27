import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  EVENT_COLORS,
  SEOUL_OFFSET,
  addDays,
  diffDays,
  formatClock,
  isValidDate,
  parseClock,
  parseDate,
} from "@/lib/calendar";
import { ALL_DAY_END_TIME, ALL_DAY_START_TIME, toPayload, type EventInput } from "@/lib/events/input";
import {
  AI_SEARCH_KEYWORD_CHARS,
  AI_SEARCH_MAX_DAYS,
  AI_SEARCH_MAX_EVENTS,
} from "./limits";
import { safeJson, toPromptEvent, type PromptEvent } from "./prompt";

// OpenAI 호환 형식의 도구 정의. 모델이 부를 수 있는 도구는 여기에 있는 것뿐이다.
export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_events",
      description:
        "Search the user's own calendar events that overlap a date range (inclusive, Asia/Seoul dates). Optionally filter by a keyword matched against title and description. Returns events sorted by start time.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "First date, YYYY-MM-DD." },
          end_date: {
            type: "string",
            description: `Last date, YYYY-MM-DD, on or after start_date. At most ${AI_SEARCH_MAX_DAYS} days in total.`,
          },
          keyword: {
            type: "string",
            description: "Optional text to look for in the title or description.",
          },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description:
        "Prepare a NEW calendar event as a draft for the user. This does NOT save anything: the user sees a card and must press a button to add it. Use it only when the user asks to add or schedule an event, and only when the date (and, unless all_day, the start time) is clear. Dates are Asia/Seoul.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title, at most 100 characters." },
          start_date: { type: "string", description: "Start date, YYYY-MM-DD." },
          start_time: {
            type: "string",
            description: "Start time, 24-hour HH:mm. Omit for all-day events.",
          },
          end_date: {
            type: "string",
            description: "End date, YYYY-MM-DD. Defaults to start_date.",
          },
          end_time: {
            type: "string",
            description: "End time, 24-hour HH:mm. Defaults to one hour after the start. Omit for all-day events.",
          },
          all_day: { type: "boolean", description: "True for an all-day event. Defaults to false." },
          description: { type: "string", description: "Optional notes, at most 2000 characters." },
          color: {
            type: "string",
            enum: [...EVENT_COLORS],
            description: "Optional color. Defaults to blue.",
          },
        },
        required: ["title", "start_date"],
      },
    },
  },
] as const;

// 도구 이름 → 모델이 보는 짧은 상태 표시용 키(화면 문구는 클라이언트 사전에서 고른다).
export type ToolName = (typeof AI_TOOLS)[number]["function"]["name"];
export const isToolName = (name: string): name is ToolName =>
  AI_TOOLS.some((t) => t.function.name === name);

const MAX_FETCH = 1000;

function inCalendar(date: string): boolean {
  const parts = parseDate(date);
  return !!parts && parts.year >= CALENDAR_MIN_YEAR && parts.year <= CALENDAR_MAX_YEAR;
}

function toolError(message: string): string {
  return safeJson({ error: message });
}

// 모델이 준 인자는 믿지 않고 모양과 범위를 다시 확인한다. 실패해도 던지지 않고 오류 JSON을 돌려줘
// 모델이 스스로 고쳐 다시 부르게 한다. 조회는 로그인한 사용자의 클라이언트로 하므로 RLS가 본인 일정만 돌려준다.
async function searchEvents(supabase: SupabaseClient, args: unknown): Promise<string> {
  const a = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
  const { start_date: start, end_date: end } = a;
  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    !isValidDate(start) ||
    !isValidDate(end) ||
    !inCalendar(start) ||
    !inCalendar(end)
  ) {
    return toolError("start_date and end_date must be valid dates in YYYY-MM-DD format.");
  }
  const days = diffDays(start, end) + 1;
  if (days < 1) return toolError("end_date must be on or after start_date.");
  if (days > AI_SEARCH_MAX_DAYS) {
    return toolError(`The range is too long. Use at most ${AI_SEARCH_MAX_DAYS} days per search.`);
  }
  let keyword = "";
  if (a.keyword !== undefined && a.keyword !== null) {
    if (typeof a.keyword !== "string") return toolError("keyword must be a string.");
    keyword = Array.from(a.keyword.trim()).slice(0, AI_SEARCH_KEYWORD_CHARS).join("").toLowerCase();
  }

  const { data, error } = await supabase
    .from("events")
    .select("id, title, start_at, end_at, all_day, description")
    .lt("start_at", `${addDays(end, 1)}T00:00:00${SEOUL_OFFSET}`)
    .gte("end_at", `${start}T00:00:00${SEOUL_OFFSET}`)
    .order("start_at", { ascending: true })
    .limit(MAX_FETCH);
  if (error) {
    console.error("[ai] search_events failed:", error.message);
    return toolError("The calendar could not be read right now.");
  }

  const rows = data as PromptEvent[];
  const matched = keyword
    ? rows.filter(
        (e) =>
          e.title.toLowerCase().includes(keyword) ||
          (e.description ?? "").toLowerCase().includes(keyword),
      )
    : rows;
  const returned = matched.slice(0, AI_SEARCH_MAX_EVENTS).map(toPromptEvent);
  const more = matched.length > returned.length || rows.length >= MAX_FETCH;
  return safeJson({
    range: { start, end },
    ...(keyword ? { keyword } : {}),
    total: matched.length,
    returned: returned.length,
    ...(more
      ? { note: "More events exist than were returned. Narrow the dates or add a keyword." }
      : {}),
    events: returned,
  });
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

// 일정 초안을 만든다. 저장하지 않는다: 검증을 통과한 초안을 화면으로 보내 사용자가 버튼으로 확정하게 한다.
// 입력 검증은 저장할 때(createEvent)와 같은 toPayload를 쓰고, 실패하면 오류 목록을 돌려줘 모델이 고치게 한다.
function createEventDraft(args: unknown): ToolResult {
  const a = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
  const allDay = a.all_day === true;
  const startDate = str(a.start_date) ?? "";
  const endDate = str(a.end_date) || startDate;

  let startTime = ALL_DAY_START_TIME;
  let endTime = ALL_DAY_END_TIME;
  if (!allDay) {
    startTime = str(a.start_time) ?? "";
    if (!startTime) return { content: toolError("start_time is required unless all_day is true.") };
    const startMin = parseClock(startTime);
    endTime = str(a.end_time) ?? "";
    let defaultedEndDate = endDate;
    if (!endTime && startMin !== null) {
      // 종료를 안 주면 1시간 뒤(자정을 넘으면 다음 날 00:00 이후)
      const end = startMin + 60;
      endTime = formatClock(end % (24 * 60));
      if (end >= 24 * 60 && isValidDate(startDate) && !str(a.end_date)) {
        defaultedEndDate = addDays(startDate, 1);
      }
    }
    return finishDraft(a, allDay, startDate, startTime, defaultedEndDate, endTime);
  }
  return finishDraft(a, allDay, startDate, startTime, endDate, endTime);
}

function finishDraft(
  a: Record<string, unknown>,
  allDay: boolean,
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): ToolResult {
  if (a.color !== undefined && typeof a.color !== "string") {
    return { content: toolError("color must be a string.") };
  }
  if (a.title !== undefined && typeof a.title !== "string") {
    return { content: toolError("title must be a string.") };
  }
  const input: EventInput = {
    title: str(a.title) ?? "",
    description: str(a.description) ?? "",
    allDay,
    startDate,
    startTime,
    endDate,
    endTime,
    color: str(a.color) || "blue",
  };
  const parsed = toPayload(input);
  if (!parsed.ok) {
    return { content: toolError(`Invalid event: ${JSON.stringify(parsed.errors)}`) };
  }
  return {
    draft: input,
    content: safeJson({
      status: "draft_shown_to_user",
      note: "Nothing has been saved. The user must press the Add button on the card. Do not say the event was added.",
      event: input,
    }),
  };
}

export type ToolResult = { content: string; draft?: EventInput };

// 모델이 요청한 도구를 실행한다. 알 수 없는 도구·깨진 인자도 오류 JSON으로 돌려준다.
export async function runTool(
  supabase: SupabaseClient,
  name: string,
  rawArguments: string,
): Promise<ToolResult> {
  if (!isToolName(name)) return { content: toolError("Unknown tool.") };
  let args: unknown;
  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return { content: toolError("Arguments must be valid JSON.") };
  }
  if (name === "create_event") return createEventDraft(args);
  return { content: await searchEvents(supabase, args) };
}
