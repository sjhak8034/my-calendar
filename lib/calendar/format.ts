import { SEOUL_TIME_ZONE, WEEK_START, addDays, type CalendarDate } from "./date";
import type { Locale } from "@/lib/i18n/config";

const INTL_LOCALE: Record<Locale, string> = { ko: "ko-KR", en: "en-US" };

// 달력 날짜는 UTC로 포맷해 실행 환경의 타임존 영향을 받지 않게 한다.
function utcDate(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

// Intl.DateTimeFormat 생성 비용이 커서 (locale, 옵션) 키로 모듈 레벨에 캐시한다.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

function formatCalendar(
  date: CalendarDate,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): string {
  return getFormatter(locale, { ...options, timeZone: "UTC" }).format(
    utcDate(date),
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// "2026년 10월" / "October 2026"
export function formatMonthTitle(year: number, month: number, locale: Locale) {
  return formatCalendar(`${year}-${pad2(month)}-01`, locale, {
    year: "numeric",
    month: "long",
  });
}

// "2026. 10. 1. – 2026. 10. 31." / "Oct 1, 2026 – Oct 31, 2026"
export function formatPeriod(
  start: CalendarDate,
  end: CalendarDate,
  locale: Locale,
) {
  const options: Intl.DateTimeFormatOptions =
    locale === "ko"
      ? { year: "numeric", month: "numeric", day: "numeric" }
      : { year: "numeric", month: "short", day: "numeric" };
  return `${formatCalendar(start, locale, options)} – ${formatCalendar(end, locale, options)}`;
}

// 배지용 월 약칭: "10월" / "Oct"
export function formatMonthShort(month: number, locale: Locale) {
  return formatCalendar(`2000-${pad2(month)}-01`, locale, { month: "short" });
}

// WEEK_START부터 7개: 월 화 수 목 금 토 일 / Mon … Sun
export function getWeekdayNames(locale: Locale): string[] {
  // 2024-01-01은 월요일
  return Array.from({ length: 7 }, (_, i) =>
    formatCalendar(addDays("2024-01-01", WEEK_START - 1 + i), locale, {
      weekday: "short",
    }),
  );
}

// aria-label용: "2026년 10월 25일 일요일" / "Sunday, October 25, 2026"
export function formatFullDate(date: CalendarDate, locale: Locale) {
  return formatCalendar(date, locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

// 서울 시간대 시각: "오전 9:00" / "9:00 AM"
export function formatTime(iso: string, locale: Locale) {
  return getFormatter(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: SEOUL_TIME_ZONE,
  }).format(new Date(iso));
}

// 사전 문자열의 {key} 자리표시자 치환
export function fillTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
