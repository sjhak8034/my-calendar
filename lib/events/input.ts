import {
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  EVENT_COLORS,
  addDays,
  formatClock,
  fromDayRange,
  isValidDate,
  parseClock,
  parseDate,
  toSeoulDateTime,
  toSeoulIso,
  type CalendarDate,
  type DayRange,
} from "@/lib/calendar";

// 폼 입력값. 날짜·시각은 서울 기준 문자열(YYYY-MM-DD, HH:mm)이다.
export type EventInput = {
  title: string;
  description: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  color: string;
};

export type EventPayload = {
  title: string;
  description: string | null;
  all_day: boolean;
  start_at: string;
  end_at: string;
  color: string;
};

export type EventField = "title" | "description" | "start" | "end" | "color";

export type EventErrorCode =
  | "titleRequired"
  | "titleTooLong"
  | "descriptionTooLong"
  | "invalidStart"
  | "invalidEnd"
  | "endBeforeStart"
  | "invalidColor";

export type EventErrors = Partial<Record<EventField, EventErrorCode>>;

export type ParseResult =
  | { ok: true; payload: EventPayload }
  | { ok: false; errors: EventErrors };

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 2000;

// 입력 칸의 maxLength: 한도를 조금 넘겨 입력할 수 있게 두어 검증 메시지를 보여 준다.
export const TITLE_INPUT_LIMIT = TITLE_MAX + 50;
export const DESCRIPTION_INPUT_LIMIT = DESCRIPTION_MAX + 200;

export const ALL_DAY_START_TIME = "00:00";
export const ALL_DAY_END_TIME = "23:59";

function toInstant(date: string, time: string): number | null {
  if (!isValidDate(date) || parseClock(time) === null) return null;
  const parts = parseDate(date);
  if (!parts || parts.year < CALENDAR_MIN_YEAR || parts.year > CALENDAR_MAX_YEAR) {
    return null;
  }
  const ms = Date.parse(toSeoulIso(date, time));
  return Number.isNaN(ms) ? null : ms;
}

// Server Action은 직접 POST로도 호출되어 타입이 보장되지 않으므로, 검증 전에 값의 모양을 확인한다.
export function isEventInput(value: unknown): value is EventInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === "string" &&
    typeof v.description === "string" &&
    typeof v.allDay === "boolean" &&
    typeof v.startDate === "string" &&
    typeof v.startTime === "string" &&
    typeof v.endDate === "string" &&
    typeof v.endTime === "string" &&
    typeof v.color === "string"
  );
}

// 입력 검증 + 저장 형태로 변환. 종료는 입력한 종료일·종료 시각 그대로 저장한다.
export function toPayload(input: EventInput): ParseResult {
  const errors: EventErrors = {};

  const title = input.title.trim();
  if (!title) errors.title = "titleRequired";
  else if (title.length > TITLE_MAX) errors.title = "titleTooLong";

  const description = input.description.trim();
  if (description.length > DESCRIPTION_MAX) errors.description = "descriptionTooLong";

  if (!(EVENT_COLORS as readonly string[]).includes(input.color)) {
    errors.color = "invalidColor";
  }

  const start = toInstant(input.startDate, input.startTime);
  const end = toInstant(input.endDate, input.endTime);
  if (start === null) errors.start = "invalidStart";
  if (end === null) errors.end = "invalidEnd";
  if (start !== null && end !== null && end < start) errors.end = "endBeforeStart";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      title,
      description: description || null,
      all_day: input.allDay,
      start_at: toSeoulIso(input.startDate, input.startTime),
      end_at: toSeoulIso(input.endDate, input.endTime),
      color: input.color,
    },
  };
}

// 새 일정 초기값: 시작 = 해당 날짜의 minutes(분), 종료 = 1시간 뒤(자정을 넘으면 다음 날)
export function defaultInput(date: CalendarDate, minutes = 9 * 60): EventInput {
  const end = minutes + 60;
  return {
    title: "",
    description: "",
    allDay: false,
    startDate: date,
    startTime: formatClock(minutes),
    endDate: end >= 24 * 60 ? addDays(date, 1) : date,
    endTime: formatClock(end % (24 * 60)),
    color: "blue",
  };
}

export type StoredEvent = {
  title: string;
  description: string | null;
  all_day: boolean;
  start_at: string;
  end_at: string;
  color: string | null;
};

// 수정·삭제 대상이 되는 일정(화면에 내려보내는 원본 값)
export type EditableEvent = StoredEvent & { id: string };

// 저장된 일정 → 수정 폼 초기값
export function fromEvent(event: StoredEvent): EventInput {
  const start = toSeoulDateTime(event.start_at);
  const end = toSeoulDateTime(event.end_at);
  return {
    title: event.title,
    description: event.description ?? "",
    allDay: event.all_day,
    startDate: start.date,
    startTime: formatClock(start.minutes),
    endDate: end.date,
    endTime: formatClock(end.minutes),
    color: event.color ?? "gray",
  };
}

// 하루 안의 구간 → 저장 형태의 시작·종료 시각(서울 +09:00). toPayload와 같은 규칙.
export function rangeToIso(range: DayRange): { start_at: string; end_at: string } {
  const f = fromDayRange(range);
  return {
    start_at: toSeoulIso(f.startDate, f.startTime),
    end_at: toSeoulIso(f.endDate, f.endTime),
  };
}

// 일정의 시각만 새 구간으로 바꾼 복사본(낙관적 업데이트용)
export function applyRange<T extends { start_at: string; end_at: string }>(
  event: T,
  range: DayRange,
): T {
  return { ...event, ...rangeToIso(range) };
}

// 시각만 바꾸는 이동·크기 조절 입력(드래그). 하루 안의 구간이다.
export function parseMoveRange(value: unknown): DayRange | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const { date, startMin, endMin } = v;
  if (typeof date !== "string" || !isValidDate(date)) return null;
  const parts = parseDate(date);
  if (!parts || parts.year < CALENDAR_MIN_YEAR || parts.year > CALENDAR_MAX_YEAR) return null;
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) return null;
  const start = startMin as number;
  const end = endMin as number;
  if (start < 0 || end < start || end > 24 * 60) return null;
  return { date, startMin: start, endMin: end };
}
