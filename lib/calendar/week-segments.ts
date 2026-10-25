import {
  addDays,
  compareDates,
  diffDays,
  isSeoulMidnight,
  toSeoulDate,
  type CalendarDate,
} from "./date";
import type { MonthGrid } from "./month-grid";

export type DateSpan = { start: CalendarDate; end: CalendarDate };

export type WeekSegment = {
  weekIndex: number;
  startCol: number;
  endCol: number;
  continuesFromPrev: boolean;
  continuesToNext: boolean;
};

// 서울 기준 날짜 구간(양끝 포함). 종료가 서울 기준 정확히 00:00이고
// 시작 날짜보다 늦으면 전날까지로 본다.
export function eventDateSpan(startAt: string, endAt: string): DateSpan {
  const start = toSeoulDate(startAt);
  let end = toSeoulDate(endAt);
  if (compareDates(end, start) > 0 && isSeoulMidnight(endAt)) {
    end = addDays(end, -1);
  }
  if (compareDates(end, start) < 0) end = start;
  return { start, end };
}

// 그리드의 각 주와 겹치는 조각. 그리드 밖은 잘라 내고 이어짐 플래그로 표시한다.
export function splitIntoWeekSegments(
  span: DateSpan,
  grid: MonthGrid,
): WeekSegment[] {
  const segments: WeekSegment[] = [];
  grid.forEach((week, weekIndex) => {
    const weekStart = week[0].date;
    const weekEnd = week[week.length - 1].date;
    if (
      compareDates(span.end, weekStart) < 0 ||
      compareDates(span.start, weekEnd) > 0
    ) {
      return;
    }
    const from = compareDates(span.start, weekStart) > 0 ? span.start : weekStart;
    const to = compareDates(span.end, weekEnd) < 0 ? span.end : weekEnd;
    segments.push({
      weekIndex,
      startCol: diffDays(weekStart, from),
      endCol: diffDays(weekStart, to),
      continuesFromPrev: compareDates(span.start, from) < 0,
      continuesToNext: compareDates(span.end, to) > 0,
    });
  });
  return segments;
}
