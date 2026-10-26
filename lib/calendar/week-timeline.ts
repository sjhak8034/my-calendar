import {
  diffDays,
  toSeoulDateTime,
  type CalendarDate,
} from "./date";
import { layoutWeek, type LaneInput } from "./lanes";
import { eventDateSpan, splitIntoWeekSegments } from "./week-segments";

// lib/events의 CalendarEvent와 호환되는 최소 구조(lib/calendar는 lib/events를 import하지 않는다).
export type TimelineEventInput = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string | null;
};

export type TimelineOptions = {
  startHour?: number; // 표시 시작 시(기본 6)
  endHour?: number; // 표시 끝 시(기본 24)
  minBlockMinutes?: number; // 최소 블록 길이(분, 기본 26: 시간당 3.5rem 기준 약 24px)
};

export const DEFAULT_TIMELINE_OPTIONS = {
  startHour: 6,
  endHour: 24,
  minBlockMinutes: 26,
} as const;

const MINUTES_PER_DAY = 1440;

export type OverlapColumn = { column: number; columnCount: number };

// 같은 날 블록의 겹침 열 배정. top/bottom은 분이며 bottom은 미포함(끝 = 다음 시작이면 겹치지 않음).
// 시작 순(같으면 긴 것 먼저)으로 정렬해 첫 빈 열에 넣고, 서로 이어서 겹치는 묶음(cluster)의
// 최대 열 수를 묶음 전체의 columnCount로 쓴다. 반환은 정렬된 순서이며 입력은 변이하지 않는다.
export function layoutOverlaps<T extends { top: number; bottom: number }>(
  blocks: readonly T[],
): (T & OverlapColumn)[] {
  const sorted = blocks
    .map((block, index) => ({ block, index }))
    .sort(
      (a, b) =>
        a.block.top - b.block.top ||
        b.block.bottom - a.block.bottom ||
        a.index - b.index,
    )
    .map(({ block }) => block);

  const result: (T & OverlapColumn)[] = [];
  let clusterStart = 0;
  let clusterEnd = -Infinity;
  let columnEnds: number[] = [];

  const closeCluster = () => {
    for (let i = clusterStart; i < result.length; i++) {
      result[i].columnCount = columnEnds.length;
    }
  };

  for (const block of sorted) {
    if (block.top >= clusterEnd) {
      closeCluster();
      clusterStart = result.length;
      columnEnds = [];
    }
    let column = columnEnds.findIndex((end) => end <= block.top);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = block.bottom;
    clusterEnd = Math.max(clusterEnd, block.bottom);
    result.push({ ...block, column, columnCount: 1 });
  }
  closeCluster();
  return result;
}

export type AllDayBar = {
  key: string;
  id: string;
  title: string;
  color: string | null;
  startCol: number; // 0~6
  endCol: number;
  lane: number;
  continuesFromPrev: boolean;
  continuesToNext: boolean;
  startAt: string;
  endAt: string;
};

export type EarlyEvent = {
  key: string; // `${id}:${date}`
  id: string;
  title: string;
  color: string | null;
  startAt: string;
  endAt: string;
  startMinute: number; // 그 날 00:00부터의 분
  endMinute: number;
};

export type TimeBlock = EarlyEvent &
  OverlapColumn & {
    date: CalendarDate;
    allDay: false;
    top: number; // 표시 범위로 자르고 최소 높이를 보장한 분
    bottom: number;
    clippedTop: boolean; // 표시 시작 이전에 시작함
    clippedBottom: boolean; // 표시 끝 이후(다음 날 포함)까지 이어짐
  };

export type DayTimeline = {
  date: CalendarDate;
  earlyEvents: EarlyEvent[];
  blocks: TimeBlock[];
};

export type WeekTimeline = {
  allDay: { bars: AllDayBar[]; laneCount: number };
  days: DayTimeline[]; // weekDays와 같은 순서
  skipped: string[]; // 잘못된 데이터로 건너뛴 일정 id
};

// continues: 실제 일정 끝이 이 날의 끝(다음 날 00:00)보다 뒤임
type DayPiece = { dayIndex: number; start: number; end: number; continues: boolean };

// 시간 일정 → 날짜별 [시작분, 끝분] (0~1440). 서울 기준 절대 분 = 일수 * 1440 + 분.
function splitIntoDayPieces(
  event: TimelineEventInput,
  firstDay: CalendarDate,
  dayCount: number,
  minBlockMinutes: number,
): DayPiece[] {
  const s = toSeoulDateTime(event.start_at);
  const e = toSeoulDateTime(event.end_at);
  const startAbs = diffDays(firstDay, s.date) * MINUTES_PER_DAY + s.minutes;
  const endAbs = diffDays(firstDay, e.date) * MINUTES_PER_DAY + e.minutes;

  if (endAbs <= startAbs) {
    // 길이 0(또는 끝이 시작보다 빠름): 시작 시각부터 최소 길이, 24:00을 넘지 않게
    const dayIndex = diffDays(firstDay, s.date);
    if (dayIndex < 0 || dayIndex >= dayCount) return [];
    return [
      {
        dayIndex,
        start: s.minutes,
        end: Math.min(s.minutes + minBlockMinutes, MINUTES_PER_DAY),
        continues: false,
      },
    ];
  }

  const pieces: DayPiece[] = [];
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const dayStart = dayIndex * MINUTES_PER_DAY;
    const start = Math.max(startAbs, dayStart) - dayStart;
    const end = Math.min(endAbs, dayStart + MINUTES_PER_DAY) - dayStart;
    if (end > start) {
      pieces.push({ dayIndex, start, end, continues: endAbs > dayStart + MINUTES_PER_DAY });
    }
  }
  return pieces;
}

export function buildWeekTimeline(
  weekDays: readonly CalendarDate[],
  events: readonly TimelineEventInput[],
  options: TimelineOptions = {},
): WeekTimeline {
  const startHour = options.startHour ?? DEFAULT_TIMELINE_OPTIONS.startHour;
  const endHour = options.endHour ?? DEFAULT_TIMELINE_OPTIONS.endHour;
  const minBlock =
    options.minBlockMinutes ?? DEFAULT_TIMELINE_OPTIONS.minBlockMinutes;
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;

  const oneWeekGrid = [weekDays.map((date) => ({ date, inMonth: true }))];
  const barInputs: (LaneInput & {
    title: string;
    color: string | null;
    endAt: string;
  })[] = [];
  const earlyByDay: EarlyEvent[][] = weekDays.map(() => []);
  const rawBlocksByDay: Omit<TimeBlock, keyof OverlapColumn>[][] =
    weekDays.map(() => []);
  const skipped: string[] = [];

  for (const event of events) {
    try {
      if (event.all_day) {
        const span = eventDateSpan(event.start_at, event.end_at);
        const spanDays = diffDays(span.start, span.end) + 1;
        const bars = splitIntoWeekSegments(span, oneWeekGrid).map((segment) => ({
          ...segment,
          id: event.id,
          allDay: true,
          startAt: event.start_at,
          endAt: event.end_at,
          spanDays,
          title: event.title,
          color: event.color,
        }));
        barInputs.push(...bars);
        continue;
      }

      // 일정 하나를 전부 계산한 뒤에 반영해, 중간에 실패해도 일부만 남지 않게 한다.
      const early: [number, EarlyEvent][] = [];
      const blocks: [number, Omit<TimeBlock, keyof OverlapColumn>][] = [];
      for (const { dayIndex, start, end, continues } of splitIntoDayPieces(
        event,
        weekDays[0],
        weekDays.length,
        minBlock,
      )) {
        const date = weekDays[dayIndex];
        const base: EarlyEvent = {
          key: `${event.id}:${date}`,
          id: event.id,
          title: event.title,
          color: event.color,
          startAt: event.start_at,
          endAt: event.end_at,
          startMinute: start,
          endMinute: end,
        };
        if (end <= rangeStart) {
          early.push([dayIndex, base]);
          continue;
        }
        if (start >= rangeEnd) continue;

        const top = Math.max(start, rangeStart);
        let bottom = Math.min(end, rangeEnd);
        let displayTop = top;
        if (bottom - top < minBlock) {
          bottom = Math.min(top + minBlock, rangeEnd);
          displayTop = Math.min(top, bottom - minBlock);
        }
        blocks.push([
          dayIndex,
          {
            ...base,
            date,
            allDay: false,
            top: displayTop,
            bottom,
            clippedTop: start < rangeStart,
            clippedBottom: continues || end > rangeEnd,
          },
        ]);
      }
      for (const [i, item] of early) earlyByDay[i].push(item);
      for (const [i, item] of blocks) rawBlocksByDay[i].push(item);
    } catch {
      skipped.push(event.id);
    }
  }

  const layout = layoutWeek(barInputs, { maxLanes: Infinity });
  const bars: AllDayBar[] = layout.placed.map((p) => ({
    key: p.id,
    id: p.id,
    title: p.title,
    color: p.color,
    startCol: p.startCol,
    endCol: p.endCol,
    lane: p.lane,
    continuesFromPrev: p.continuesFromPrev,
    continuesToNext: p.continuesToNext,
    startAt: p.startAt,
    endAt: p.endAt,
  }));

  const byStart = (a: EarlyEvent, b: EarlyEvent) =>
    a.startMinute - b.startMinute || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  return {
    allDay: { bars, laneCount: layout.laneCount },
    days: weekDays.map((date, i) => ({
      date,
      earlyEvents: earlyByDay[i].sort(byStart),
      blocks: layoutOverlaps(rawBlocksByDay[i]) as TimeBlock[],
    })),
    skipped,
  };
}
