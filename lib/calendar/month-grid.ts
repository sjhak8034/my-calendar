import {
  addDays,
  formatDate,
  startOfWeek,
  type CalendarDate,
} from "./date";

export const GRID_WEEKS = 6;
export const DAYS_PER_WEEK = 7;

export type GridDay = { date: CalendarDate; inMonth: boolean };
export type MonthGrid = GridDay[][];

export type YearMonth = { year: number; month: number };

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

// 항상 6주 × 7일. 첫 칸은 그 달 1일이 속한 주의 시작일(월요일).
export function getMonthGrid(year: number, month: number): MonthGrid {
  const first = startOfWeek(formatDate({ year, month, day: 1 }));
  const grid: MonthGrid = [];
  for (let week = 0; week < GRID_WEEKS; week++) {
    const row: GridDay[] = [];
    for (let col = 0; col < DAYS_PER_WEEK; col++) {
      const date = addDays(first, week * DAYS_PER_WEEK + col);
      row.push({ date, inMonth: date.startsWith(monthPrefix(year, month)) });
    }
    grid.push(row);
  }
  return grid;
}

function monthPrefix(year: number, month: number): string {
  return formatDate({ year, month, day: 1 }).slice(0, 7);
}

export function getAdjacentMonth(
  year: number,
  month: number,
  delta: number,
): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 };
}

// "YYYY-MM" → 값, 잘못된 입력은 null
export function parseMonthParam(value: string | undefined): YearMonth | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < MIN_YEAR || year > MAX_YEAR) {
    return null;
  }
  return { year, month };
}

export function formatMonthParam(year: number, month: number): string {
  return monthPrefix(year, month);
}
