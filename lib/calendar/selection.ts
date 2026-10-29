import { addDays, compareDates, isValidDate, type CalendarDate } from "./date";
import type { DateSpan } from "./week-segments";

// 월간 그리드에서 끌어 고른 두 날짜를 시작 ≤ 종료 순서로 정렬한다(25일에서 20일로 거꾸로 끌어도 같은 범위).
export function normalizeRange(a: CalendarDate, b: CalendarDate): DateSpan {
  return compareDates(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
}

// 폼에 적힌 시작·종료 날짜가 하이라이트로 그릴 수 있는 범위인지 확인한다.
// 사용자가 날짜 입력을 지우는 중이거나 종료가 시작보다 이르면 null(하이라이트를 그리지 않는다).
export function validSpan(start: string, end: string): DateSpan | null {
  if (!isValidDate(start) || !isValidDate(end)) return null;
  return compareDates(start, end) <= 0 ? { start, end } : null;
}

// 월간에서 일정 막대를 끌어 날짜를 바꿀 때의 새 구간(양끝 포함, 길이는 최소 하루).
// 통째로 옮기기: 기간 길이를 그대로 두고 days일만큼 민다.
export function shiftSpan(span: DateSpan, days: number): DateSpan {
  return { start: addDays(span.start, days), end: addDays(span.end, days) };
}

// 시작일 늘이기·줄이기: 종료일을 넘기면 시작일을 종료일에 맞춘다(하루짜리가 최소).
export function withStart(span: DateSpan, date: CalendarDate): DateSpan {
  return compareDates(date, span.end) <= 0 ? { start: date, end: span.end } : { start: span.end, end: span.end };
}

// 종료일 늘이기·줄이기: 시작일보다 앞서면 종료일을 시작일에 맞춘다(하루짜리가 최소).
export function withEnd(span: DateSpan, date: CalendarDate): DateSpan {
  return compareDates(date, span.start) >= 0 ? { start: span.start, end: date } : { start: span.start, end: span.start };
}
