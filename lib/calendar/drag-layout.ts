import {
  GRID_BOUNDS,
  GRID_END_HOUR,
  GRID_MINUTES,
  GRID_START_HOUR,
  dayIndexFromX,
  minuteFromY,
  moveRange,
  resizeRange,
  resizeRangeRaw,
  type DayRange,
} from "./drag";
import type { CalendarDate } from "./date";
import { DEFAULT_TIMELINE_OPTIONS } from "./week-timeline";

// 날짜 열의 화면 위치. 첫 열의 top/height가 그리드의 세로 기준이 된다(모든 열이 같은 높이).
export type ColumnRect = {
  date: CalendarDate;
  left: number;
  top: number;
  width: number;
  height: number;
};

// 열 안에서 블록이 양옆에 두는 여백(px). 오버레이의 inset-x-[3px]와 맞춘다.
export const COLUMN_INSET_PX = 3;

// 블록의 최소 표시 길이(분)
export const MIN_BLOCK_MINUTES = DEFAULT_TIMELINE_OPTIONS.minBlockMinutes;

export type DragGeometryInput = {
  mode: "move" | "start" | "end";
  range: DayRange; // 드래그를 시작할 때의 구간
  grab: number; // 잡은 지점이 구간 시작에서 떨어진 분
};

// 포인터 위치 → 새 구간(15분 단위로 맞춤). 열이 없으면 null.
export function positionAt(
  input: DragGeometryInput,
  x: number,
  y: number,
  columns: readonly ColumnRect[],
): DayRange | null {
  if (columns.length === 0) return null;
  const raw = minuteFromY(y, columns[0], GRID_START_HOUR, GRID_END_HOUR);
  if (input.mode === "move") {
    const column = columns[dayIndexFromX(x, columns.map((c) => ({ left: c.left, right: c.left + c.width })))];
    return { date: column.date, ...moveRange(input.range, input.grab, raw, GRID_BOUNDS) };
  }
  return {
    date: input.range.date,
    ...resizeRange(input.range, input.mode, raw, GRID_BOUNDS),
  };
}

// 놓을 열·15분 칸에 대응하는 화면 좌표(떠 있는 블록이 안착할 자리)
export function settleGeometry(range: DayRange, columns: readonly ColumnRect[]) {
  const grid = columns[0];
  const column = columns.find((c) => c.date === range.date) ?? grid;
  const minutes = Math.max(range.endMin - range.startMin, MIN_BLOCK_MINUTES);
  return {
    settleLeft: column.left + COLUMN_INSET_PX,
    settleWidth: column.width - COLUMN_INSET_PX * 2,
    settleTop: grid.top + ((range.startMin - GRID_START_HOUR * 60) / GRID_MINUTES) * grid.height,
    height: (minutes / GRID_MINUTES) * grid.height,
  };
}

// 크기 조절 중 늘어나는 가장자리가 시작 범위에서 포인터를 따라 움직인 거리(px, 스냅 없음)
export function resizeOffsetPx(
  mode: "start" | "end",
  range: DayRange,
  y: number,
  columns: readonly ColumnRect[],
): number {
  const grid = columns[0];
  const raw = minuteFromY(y, grid, GRID_START_HOUR, GRID_END_HOUR);
  const next = resizeRangeRaw(range, mode, raw, GRID_BOUNDS);
  const delta = mode === "end" ? next.endMin - range.endMin : next.startMin - range.startMin;
  return (delta / GRID_MINUTES) * grid.height;
}

// 포인터가 사각형 위에 있는지(가장자리 포함). margin만큼 사방으로 넓혀 판정한다.
export function isOverRect(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number } | null,
  margin = 0,
): boolean {
  if (!rect) return false;
  return (
    x >= rect.left - margin &&
    x <= rect.left + rect.width + margin &&
    y >= rect.top - margin &&
    y <= rect.top + rect.height + margin
  );
}
