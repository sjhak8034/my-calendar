import { addDays, diffDays, isValidDate, type CalendarDate } from "./date";

// 주간 시간표의 드래그 이동·크기 조절 계산. DOM을 모르는 순수 함수로 두고,
// 포인터 이벤트 처리는 components/calendar/week-editor.tsx가 한다.

// 주간 시간표가 보여 주는 시간 범위
export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 24;
export const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
export const GRID_BOUNDS = { min: GRID_START_HOUR * 60, max: GRID_END_HOUR * 60 } as const;

export const SNAP_MINUTES = 15;
export const MIN_DURATION = SNAP_MINUTES;
const MINUTES_PER_DAY = 24 * 60;

// 한 날짜 안의 시간 구간(그 날 00:00부터의 분). endMin은 24:00 = 1440까지 허용.
export type DayRange = { date: CalendarDate; startMin: number; endMin: number };
export type Bounds = { min: number; max: number };

export function snap(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// 화면 y 좌표 → 그 날 00:00부터의 분(스냅·범위 제한 없음). rect는 날짜 열의 화면 위치.
export function minuteFromY(
  y: number,
  rect: { top: number; height: number },
  startHour: number,
  endHour: number,
): number {
  if (rect.height <= 0) return startHour * 60;
  const ratio = (y - rect.top) / rect.height;
  return startHour * 60 + ratio * (endHour - startHour) * 60;
}

// 화면 x 좌표 → 날짜 열 번호. 범위 밖이면 가장 가까운 끝 열.
export function dayIndexFromX(
  x: number,
  columns: readonly { left: number; right: number }[],
): number {
  if (columns.length === 0) return 0;
  for (let i = 0; i < columns.length; i++) {
    if (x < columns[i].right) return i;
  }
  return columns.length - 1;
}

// 구간을 끌어 옮긴다. 길이를 유지하고 bounds 안으로 밀어 넣는다.
// grabOffset: 잡은 지점이 구간 시작에서 떨어진 분(잡을 때 pointerMin - startMin).
export function moveRange(
  range: { startMin: number; endMin: number },
  grabOffset: number,
  pointerMin: number,
  bounds: Bounds,
): { startMin: number; endMin: number } {
  const duration = range.endMin - range.startMin;
  const maxStart = Math.max(bounds.min, bounds.max - duration);
  const startMin = clamp(snap(pointerMin - grabOffset), bounds.min, maxStart);
  return { startMin, endMin: startMin + duration };
}

// 위(start)·아래(end) 가장자리를 끌어 길이를 바꾼다. 최소 길이를 지키고 반대편을 넘지 않는다.
export function resizeRange(
  range: { startMin: number; endMin: number },
  edge: "start" | "end",
  pointerMin: number,
  bounds: Bounds,
): { startMin: number; endMin: number } {
  if (edge === "end") {
    const minEnd = Math.min(range.startMin + MIN_DURATION, bounds.max);
    return {
      startMin: range.startMin,
      endMin: clamp(snap(pointerMin), minEnd, bounds.max),
    };
  }
  const maxStart = Math.max(range.endMin - MIN_DURATION, bounds.min);
  return {
    startMin: clamp(snap(pointerMin), bounds.min, maxStart),
    endMin: range.endMin,
  };
}

// resizeRange와 같지만 스냅하지 않는다. 끄는 동안 가장자리를 포인터에 픽셀 단위로 붙이는 용도.
export function resizeRangeRaw(
  range: { startMin: number; endMin: number },
  edge: "start" | "end",
  pointerMin: number,
  bounds: Bounds,
): { startMin: number; endMin: number } {
  if (edge === "end") {
    const minEnd = Math.min(range.startMin + MIN_DURATION, bounds.max);
    return { startMin: range.startMin, endMin: clamp(pointerMin, minEnd, bounds.max) };
  }
  const maxStart = Math.max(range.endMin - MIN_DURATION, bounds.min);
  return { startMin: clamp(pointerMin, bounds.min, maxStart), endMin: range.endMin };
}

// 시작~끝을 `09:00 – 10:30` 형태로(블록 안 시간 표시)
export function formatClockRange(startMin: number, endMin: number): string {
  return `${formatClock(startMin)} – ${formatClock(endMin)}`;
}

export function parseClock(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h > 23 || m > 59 ? null : h * 60 + m;
}

export function formatClock(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

type RangeFields = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

// 폼 값(날짜·시각 문자열) → 하루 안의 구간. 하루를 넘거나 값이 잘못됐으면 null.
// 다음 날 00:00 끝은 24:00(1440)으로 본다.
export function toDayRange(values: RangeFields): DayRange | null {
  if (!isValidDate(values.startDate) || !isValidDate(values.endDate)) return null;
  const startMin = parseClock(values.startTime);
  const endClock = parseClock(values.endTime);
  if (startMin === null || endClock === null) return null;
  if (values.endDate === values.startDate) {
    return endClock < startMin
      ? null
      : { date: values.startDate, startMin, endMin: endClock };
  }
  if (values.endDate === addDays(values.startDate, 1) && endClock === 0) {
    return { date: values.startDate, startMin, endMin: MINUTES_PER_DAY };
  }
  return null;
}

// 하루 안의 구간 → 폼 값. 24:00은 다음 날 00:00으로 적는다.
export function fromDayRange(range: DayRange): RangeFields {
  const overflow = range.endMin >= MINUTES_PER_DAY;
  return {
    startDate: range.date,
    startTime: formatClock(range.startMin),
    endDate: overflow ? addDays(range.date, 1) : range.date,
    endTime: formatClock(overflow ? range.endMin - MINUTES_PER_DAY : range.endMin),
  };
}

// 폼 값이 date 하루와 겹치는 부분(그 날 00:00부터의 분). 겹치지 않거나 값이 잘못되면 null.
// 길이 0인 구간은 시작 시각의 한 점으로 본다.
export function dayPiece(
  values: RangeFields,
  date: CalendarDate,
): { startMin: number; endMin: number } | null {
  if (
    !isValidDate(values.startDate) ||
    !isValidDate(values.endDate) ||
    !isValidDate(date)
  ) {
    return null;
  }
  const startClock = parseClock(values.startTime);
  const endClock = parseClock(values.endTime);
  if (startClock === null || endClock === null) return null;
  const k = diffDays(values.startDate, date);
  const startAbs = startClock;
  const endAbs = diffDays(values.startDate, values.endDate) * MINUTES_PER_DAY + endClock;
  if (endAbs < startAbs) return null;
  const dayStart = k * MINUTES_PER_DAY;
  const dayEnd = dayStart + MINUTES_PER_DAY;
  if (endAbs === startAbs) {
    return startAbs >= dayStart && startAbs < dayEnd
      ? { startMin: startAbs - dayStart, endMin: startAbs - dayStart }
      : null;
  }
  const start = Math.max(startAbs, dayStart) - dayStart;
  const end = Math.min(endAbs, dayEnd) - dayStart;
  return end > start ? { startMin: start, endMin: end } : null;
}
