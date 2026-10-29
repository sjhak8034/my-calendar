import { compareDates, isValidDate, type CalendarDate } from "./date";
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
