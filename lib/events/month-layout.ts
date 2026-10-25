import {
  eventDateSpan,
  diffDays,
  layoutWeek,
  splitIntoWeekSegments,
  type LaneInput,
  type MonthGrid,
  type WeekLayout,
  type CalendarDate,
} from "@/lib/calendar";
import type { CalendarEvent } from "./queries";

// 월 그리드에 그릴 일정 조각: 레인 배정 입력 + 표시용 필드
export type ChipSegment = LaneInput & {
  title: string;
  color: string | null;
  startDate: CalendarDate; // 일정의 첫 날(서울). 칩 링크 대상
};

export type WeekData = {
  layout: WeekLayout<ChipSegment>;
  eventCounts: number[]; // 열(0~6)별 해당 날짜에 걸친 일정 수(숨김 포함)
};

// 일정 → 주별 조각 → 레인 배정. 잘못된 일정(RangeError 등)은 그 일정만 건너뛴다.
export function buildMonthLayout(
  grid: MonthGrid,
  events: readonly CalendarEvent[],
): WeekData[] {
  const byWeek: ChipSegment[][] = grid.map(() => []);

  for (const event of events) {
    try {
      const span = eventDateSpan(event.start_at, event.end_at);
      const spanDays = diffDays(span.start, span.end) + 1;
      for (const segment of splitIntoWeekSegments(span, grid)) {
        byWeek[segment.weekIndex].push({
          ...segment,
          id: event.id,
          allDay: event.all_day,
          startAt: event.start_at,
          spanDays,
          title: event.title,
          color: event.color,
          startDate: span.start,
        });
      }
    } catch (error) {
      console.error(
        `[events] skipped invalid event ${event.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return byWeek.map((segments) => {
    const eventCounts = Array<number>(7).fill(0);
    for (const s of segments) {
      for (let col = s.startCol; col <= s.endCol; col++) eventCounts[col]++;
    }
    return { layout: layoutWeek(segments, { maxLanes: 3 }), eventCounts };
  });
}
