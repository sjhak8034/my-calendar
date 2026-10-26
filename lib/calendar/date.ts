// 날짜는 "YYYY-MM-DD" 문자열로 다루고, 계산은 Date.UTC 기반 순수 함수로 한다.
// 이 폴더에서는 Date.now(), 인자 없는 new Date(), Math.random()을 호출하지 않는다(cacheComponents).
export type CalendarDate = string;

export const SEOUL_TIME_ZONE = "Asia/Seoul";

// 현대 기준(과거 일광절약시간 구간 제외)으로 서울은 +09:00 고정 오프셋을 쓴다.
// 읽기(toSeoulDateTime)는 Intl의 역사적 규칙을 따르므로, 1962년 이전·1987~88년 구간에서는 쓰기와 최대 1시간 어긋날 수 있다.
export const SEOUL_OFFSET = "+09:00";

// 서울 기준 날짜(YYYY-MM-DD)와 시각(HH:mm) → 저장용 timestamptz 문자열
export function toSeoulIso(date: CalendarDate, time: string): string {
  return `${date}T${time}:00${SEOUL_OFFSET}`;
}

// 주 시작 요일(0=일 … 6=토). 월요일 시작.
export const WEEK_START = 1;

const MS_PER_DAY = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateParts = { year: number; month: number; day: number };

// 0~99년이 1900년대로 바뀌지 않도록 setUTCFullYear를 쓴다.
function utcMs(year: number, month: number, day: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime();
}

export function daysInMonth(year: number, month: number): number {
  // 다음 달 0일 = 이번 달 말일
  const d = new Date(0);
  d.setUTCFullYear(year, month, 0);
  return d.getUTCDate();
}

export function formatDate({ year, month, day }: DateParts): CalendarDate {
  const pad = (n: number, len: number) => String(n).padStart(len, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

// 형식이 틀리거나 존재하지 않는 날짜(2027-02-29 등)면 null
export function parseDate(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

export function isValidDate(value: string): value is CalendarDate {
  return parseDate(value) !== null;
}

function toMs(date: CalendarDate): number {
  const parts = parseDate(date);
  if (!parts) throw new RangeError(`Invalid calendar date: ${date}`);
  return utcMs(parts.year, parts.month, parts.day);
}

function fromMs(ms: number): CalendarDate {
  const d = new Date(ms);
  return formatDate({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromMs(toMs(date) + days * MS_PER_DAY);
}

// 말일 보정: 1/31 + 1개월 → 2월 말일
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const { year, month, day } = toParts(date);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12 + 12) % 12 + 1;
  return formatDate({
    year: nextYear,
    month: nextMonth,
    day: Math.min(day, daysInMonth(nextYear, nextMonth)),
  });
}

// b - a (일 수)
export function diffDays(a: CalendarDate, b: CalendarDate): number {
  return Math.round((toMs(b) - toMs(a)) / MS_PER_DAY);
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  const diff = toMs(a) - toMs(b);
  return diff === 0 ? 0 : diff < 0 ? -1 : 1;
}

// WEEK_START(월요일)이 0, 일요일이 6
export function weekdayIndex(date: CalendarDate): number {
  const day = new Date(toMs(date)).getUTCDay();
  return (day - WEEK_START + 7) % 7;
}

export function startOfWeek(date: CalendarDate): CalendarDate {
  return addDays(date, -weekdayIndex(date));
}

// date가 속한 주의 월~일 7일
export function getWeekDays(date: CalendarDate): CalendarDate[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(date: CalendarDate): CalendarDate {
  const { year, month } = toParts(date);
  return formatDate({ year, month, day: 1 });
}

export function endOfMonth(date: CalendarDate): CalendarDate {
  const { year, month } = toParts(date);
  return formatDate({ year, month, day: daysInMonth(year, month) });
}

function toParts(date: CalendarDate): DateParts {
  const parts = parseDate(date);
  if (!parts) throw new RangeError(`Invalid calendar date: ${date}`);
  return parts;
}

const seoulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function seoulParts(instant: Date) {
  const map: Record<string, string> = {};
  for (const part of seoulFormatter.formatToParts(instant)) {
    map[part.type] = part.value;
  }
  return {
    date: formatDate({
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
    }),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function parseInstant(iso: string): Date {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Invalid timestamp: ${iso}`);
  }
  return instant;
}

// timestamptz 문자열 → 서울 기준 날짜
export function toSeoulDate(iso: string): CalendarDate {
  return seoulParts(parseInstant(iso)).date;
}

// timestamptz 문자열 → 서울 기준 날짜와 그 날 00:00부터의 분(0~1439, 초는 버림)
export function toSeoulDateTime(iso: string): {
  date: CalendarDate;
  minutes: number;
} {
  const p = seoulParts(parseInstant(iso));
  return { date: p.date, minutes: p.hour * 60 + p.minute };
}

// 서울 기준 정확히 00:00:00.000인지
export function isSeoulMidnight(iso: string): boolean {
  const instant = parseInstant(iso);
  const p = seoulParts(instant);
  return (
    p.hour === 0 &&
    p.minute === 0 &&
    p.second === 0 &&
    instant.getUTCMilliseconds() === 0
  );
}

// 현재 시각은 호출하는 쪽에서 받아 넘긴다.
export function todayInSeoul(now: Date): CalendarDate {
  return seoulParts(now).date;
}
