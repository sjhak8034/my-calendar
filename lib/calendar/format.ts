import {
  SEOUL_TIME_ZONE,
  WEEK_START,
  addDays,
  toSeoulDate,
  weekdayIndex,
  type CalendarDate,
} from "./date";
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

// 화면에 보이는 날짜 문구(요일·월·제목·기간)는 언어 설정과 무관하게 영어 약어로 고정한다.
// 시각(오전/오후)과 시간 눈금, aria-label용 전체 날짜만 locale을 따른다.
const DATE_LOCALE: Locale = "en";

const pad2 = (n: number) => String(n).padStart(2, "0");

// "Oct 2026" (로케일 인자 없음: 항상 영어)
export function formatMonthTitle(year: number, month: number) {
  return formatCalendar(`${year}-${pad2(month)}-01`, DATE_LOCALE, {
    year: "numeric",
    month: "short",
  });
}

// "Oct 1, 2026 – Oct 31, 2026" (로케일과 무관)
export function formatPeriod(start: CalendarDate, end: CalendarDate) {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return `${formatCalendar(start, DATE_LOCALE, options)} – ${formatCalendar(end, DATE_LOCALE, options)}`;
}

// 배지용 월 약칭: "Oct" (로케일과 무관)
export function formatMonthShort(month: number) {
  return formatCalendar(`2000-${pad2(month)}-01`, DATE_LOCALE, {
    month: "short",
  });
}

// WEEK_START(일요일)부터 7개. 한국어 화면은 "일 월 화 수 목 금 토", 영어 화면은 "Sun Mon Tue …".
export function getWeekdayNames(locale: Locale): string[] {
  // 2024-01-07은 일요일
  return Array.from({ length: 7 }, (_, i) =>
    formatCalendar(addDays("2024-01-07", WEEK_START + i), locale, {
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

// 보이는 짧은 날짜: "Wed, Oct 21" (로케일과 무관)
export function formatShortDate(date: CalendarDate) {
  return formatCalendar(date, DATE_LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
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

// 주 제목: "Oct 19 – 25, 2026" (달·연도가 바뀌면 필요한 만큼만 반복, 로케일과 무관)
export function formatWeekTitle(start: CalendarDate, end: CalendarDate) {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  const dayOnly = (date: CalendarDate) =>
    formatCalendar(date, DATE_LOCALE, { day: "numeric" });
  const monthDay = (date: CalendarDate) =>
    formatCalendar(date, DATE_LOCALE, { month: "short", day: "numeric" });
  const full = (date: CalendarDate) =>
    formatCalendar(date, DATE_LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (!sameYear) return `${full(start)} – ${full(end)}`;
  const year = end.slice(0, 4);
  return `${monthDay(start)} – ${sameMonth ? dayOnly(end) : monthDay(end)}, ${year}`;
}

// 시간 눈금 라벨: "오전 9시" / "9 AM". 0과 24는 자정(오전 12시 / 12 AM).
export function formatHourLabel(hour: number, locale: Locale) {
  return getFormatter(locale, {
    hour: "numeric",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, ((hour % 24) + 24) % 24)));
}

// 서울 기준 시간 범위. 같은 날이면 "오전 9:00 – 오전 10:30",
// 다른 날이면 양끝에 영어 날짜(시각만 로케일): ko "Oct 22 오후 11:00 – Oct 23 오전 2:00",
// en "Oct 22, 11:00 PM – Oct 23, 2:00 AM"
export function formatTimeRange(
  startIso: string,
  endIso: string,
  locale: Locale,
) {
  const start = formatTime(startIso, locale);
  const end = formatTime(endIso, locale);
  if (toSeoulDate(startIso) === toSeoulDate(endIso)) {
    return `${start} – ${end}`;
  }
  const monthDay = (iso: string) =>
    getFormatter(DATE_LOCALE, {
      month: "short",
      day: "numeric",
      timeZone: SEOUL_TIME_ZONE,
    }).format(new Date(iso));
  const join = locale === "ko" ? " " : ", ";
  return `${monthDay(startIso)}${join}${start} – ${monthDay(endIso)}${join}${end}`;
}

// 주 헤더용: 한국어 "월 19", 영어 "Mon 19"
export function formatWeekdayDay(date: CalendarDate, locale: Locale) {
  return `${getWeekdayNames(locale)[weekdayIndex(date)]} ${Number(date.slice(8, 10))}`;
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
