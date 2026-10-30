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
  toSeoulDateTime,
  toSeoulIso,
} from "@/lib/calendar";
import {
  ALL_DAY_END_TIME,
  ALL_DAY_START_TIME,
  fromEvent,
  toPayload,
  type EventInput,
  type StoredEvent,
} from "@/lib/events/input";
import { isUuid } from "./input";
import type { AiDraft } from "./draft";
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
  {
    type: "function",
    function: {
      name: "update_event",
      description:
        "Prepare a CHANGE to an existing calendar event as a draft. This does NOT change anything: the user sees a before/after card and must press a button. Find the event first with search_events and pass its id. Send only the fields that change. If only the start moves, the original length is kept. Dates are Asia/Seoul.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "The id of the event, from search_events." },
          title: { type: "string", description: "New title, at most 100 characters." },
          start_date: { type: "string", description: "New start date, YYYY-MM-DD." },
          start_time: { type: "string", description: "New start time, 24-hour HH:mm." },
          end_date: { type: "string", description: "New end date, YYYY-MM-DD." },
          end_time: { type: "string", description: "New end time, 24-hour HH:mm." },
          all_day: { type: "boolean", description: "Set true or false to switch between all-day and timed." },
          description: { type: "string", description: "New notes, at most 2000 characters. Empty string clears them." },
          color: { type: "string", enum: [...EVENT_COLORS], description: "New color." },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_event",
      description:
        "Prepare the DELETION of one existing calendar event as a draft. This does NOT delete anything: the user sees a card and must press a button. Find the event first with search_events and pass its id.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "The id of the event, from search_events." },
        },
        required: ["event_id"],
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
    location: "",
    url: "",
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
    draft: { kind: "create", input },
    content: safeJson({
      status: "draft_shown_to_user",
      note: "Nothing has been saved. The user must press the Add button on the card. Do not say the event was added.",
      event: input,
    }),
  };
}

export type ToolResult = { content: string; draft?: AiDraft };

const EVENT_COLUMNS = "id, title, start_at, end_at, all_day, color, description, location, url";

// 변경·삭제 대상 일정을 읽는다. RLS가 본인 일정만 돌려주므로 남의 id를 줘도 "없음"이 된다.
async function loadEvent(
  supabase: SupabaseClient,
  rawId: unknown,
): Promise<{ stored: StoredEvent; id: string } | { error: string }> {
  if (!isUuid(rawId)) return { error: toolError("event_id must be an id returned by search_events.") };
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", rawId)
    .maybeSingle();
  if (error) {
    console.error("[ai] loadEvent failed:", error.message);
    return { error: toolError("The calendar could not be read right now.") };
  }
  if (!data) return { error: toolError("Event not found.") };
  return { stored: data as StoredEvent, id: rawId };
}

// 일정 수정안. 말하지 않은 필드는 그대로 두고, 시작만 옮기면 원래 길이를 유지한다.
// 저장할 때(updateEvent)와 같은 toPayload로 검증하고, 실패하면 오류를 돌려줘 모델이 고치게 한다.
async function updateEventDraft(supabase: SupabaseClient, args: unknown): Promise<ToolResult> {
  const a = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
  const loaded = await loadEvent(supabase, a.event_id);
  if ("error" in loaded) return { content: loaded.error };
  const { stored, id } = loaded;
  const before = fromEvent(stored);

  for (const key of ["title", "description", "color", "start_date", "start_time", "end_date", "end_time"]) {
    if (a[key] !== undefined && typeof a[key] !== "string") {
      return { content: toolError(`${key} must be a string.`) };
    }
  }
  if (a.all_day !== undefined && typeof a.all_day !== "boolean") {
    return { content: toolError("all_day must be a boolean.") };
  }

  const allDay = typeof a.all_day === "boolean" ? a.all_day : before.allDay;
  const startMoved = str(a.start_date) !== undefined || str(a.start_time) !== undefined;
  const endGiven = str(a.end_date) !== undefined || str(a.end_time) !== undefined;
  if (before.allDay && !allDay && !str(a.start_time)) {
    return { content: toolError("start_time is required when changing an all-day event to a timed one.") };
  }

  const startDate = str(a.start_date) || before.startDate;
  let startTime = allDay ? ALL_DAY_START_TIME : str(a.start_time) || before.startTime;
  let endDate = str(a.end_date) || before.endDate;
  let endTime = allDay ? ALL_DAY_END_TIME : str(a.end_time) || before.endTime;

  if (startMoved && !endGiven) {
    // 길이를 유지한 채 옮긴다.
    if (allDay && isValidDate(startDate) && isValidDate(before.startDate) && isValidDate(before.endDate)) {
      endDate = addDays(startDate, diffDays(before.startDate, before.endDate));
    } else if (!allDay) {
      const length = Date.parse(stored.end_at) - Date.parse(stored.start_at);
      const start = isValidDate(startDate) ? Date.parse(toSeoulIso(startDate, startTime)) : NaN;
      if (Number.isFinite(length) && Number.isFinite(start)) {
        const end = toSeoulDateTime(new Date(start + length).toISOString());
        endDate = end.date;
        endTime = formatClock(end.minutes);
      }
    }
  }
  if (allDay) startTime = ALL_DAY_START_TIME;

  const input: EventInput = {
    title: a.title !== undefined ? str(a.title) ?? "" : before.title,
    description: a.description !== undefined ? str(a.description) ?? "" : before.description,
    // AI는 장소·링크를 다루지 않으므로 기존 값을 그대로 유지한다.
    location: before.location,
    url: before.url,
    allDay,
    startDate,
    startTime,
    endDate,
    endTime,
    color: str(a.color) || before.color,
  };
  const parsed = toPayload(input);
  if (!parsed.ok) return { content: toolError(`Invalid event: ${JSON.stringify(parsed.errors)}`) };
  if (JSON.stringify(input) === JSON.stringify(before)) {
    return { content: toolError("Nothing would change. Ask the user what to change.") };
  }
  return {
    draft: { kind: "update", id, before, input },
    content: safeJson({
      status: "draft_shown_to_user",
      note: "Nothing has been changed. The user must press the button on the card. Do not say the event was changed.",
      before,
      after: input,
    }),
  };
}

async function deleteEventDraft(supabase: SupabaseClient, args: unknown): Promise<ToolResult> {
  const a = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
  const loaded = await loadEvent(supabase, a.event_id);
  if ("error" in loaded) return { content: loaded.error };
  const event = fromEvent(loaded.stored);
  return {
    draft: { kind: "delete", id: loaded.id, event },
    content: safeJson({
      status: "draft_shown_to_user",
      note: "Nothing has been deleted. The user must press the button on the card. Do not say the event was deleted.",
      event,
    }),
  };
}

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
  if (name === "update_event") return updateEventDraft(supabase, args);
  if (name === "delete_event") return deleteEventDraft(supabase, args);
  return { content: await searchEvents(supabase, args) };
}
