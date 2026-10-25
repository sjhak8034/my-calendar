import { DAYS_PER_WEEK } from "./month-grid";
import type { WeekSegment } from "./week-segments";

export const DEFAULT_MAX_LANES = 3;

// 레인 배정에 필요한 정보를 붙인 조각
export type LaneInput = WeekSegment & {
  id: string;
  allDay: boolean;
  startAt: string; // 일정 시작 시각 ISO
  spanDays: number; // 일정 전체 일수
};

export type PlacedSegment<T extends LaneInput = LaneInput> = T & {
  lane: number;
  visible: boolean;
};

export type WeekLayout<T extends LaneInput = LaneInput> = {
  placed: PlacedSegment<T>[]; // 정렬된 순서
  hiddenByDay: number[]; // 열(0~6)별 숨은 일정 수
  laneCount: number; // 보이는 레인 수
};

const isBar = (s: LaneInput) => s.allDay || s.spanDays > 1;
const length = (s: LaneInput) => s.endCol - s.startCol;

function compare(a: LaneInput, b: LaneInput): number {
  const barA = isBar(a);
  const barB = isBar(b);
  if (barA !== barB) return barA ? -1 : 1;
  if (barA) {
    // 시작 열 → 긴 것 우선
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    if (length(a) !== length(b)) return length(b) - length(a);
    if (a.spanDays !== b.spanDays) return b.spanDays - a.spanDays;
  } else if (a.startCol !== b.startCol) {
    return a.startCol - b.startCol;
  }
  const timeDiff = Date.parse(a.startAt) - Date.parse(b.startAt);
  if (timeDiff !== 0) return timeDiff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function layoutWeek<T extends LaneInput>(
  segments: readonly T[],
  options: { maxLanes?: number } = {},
): WeekLayout<T> {
  const maxLanes = options.maxLanes ?? DEFAULT_MAX_LANES;
  const sorted = [...segments].sort(compare);
  const lanes: T[][] = [];
  const hiddenByDay = Array<number>(DAYS_PER_WEEK).fill(0);

  const placed = sorted.map((segment) => {
    let lane = lanes.findIndex((items) =>
      items.every(
        (o) => segment.endCol < o.startCol || segment.startCol > o.endCol,
      ),
    );
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push(segment);

    const visible = lane < maxLanes;
    if (!visible) {
      for (let col = segment.startCol; col <= segment.endCol; col++) {
        hiddenByDay[col]++;
      }
    }
    return { ...segment, lane, visible };
  });

  return { placed, hiddenByDay, laneCount: Math.min(lanes.length, maxLanes) };
}
