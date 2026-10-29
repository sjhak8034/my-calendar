"use client";

import { useMonthSelection } from "@/components/calendar/month-select";
import { splitIntoWeekSegments, type CalendarDate } from "@/lib/calendar";

// 한 주의 기간 선택 하이라이트. 선택 범위와 겹치는 열만 막대 하나로 그린다(주를 넘으면 이어짐 쪽 모서리를 편다).
// 장식 레이어라 포인터를 받지 않고(날짜 칸의 링크가 그대로 눌린다) 스크린 리더에도 숨긴다.
export function WeekSelection({ days }: { days: CalendarDate[] }) {
  const selection = useMonthSelection();
  if (!selection) return null;
  const segment = splitIntoWeekSegments(
    selection,
    [days.map((date) => ({ date, inMonth: true }))],
  )[0];
  if (!segment) return null;

  const corners =
    segment.continuesFromPrev && segment.continuesToNext
      ? "rounded-none"
      : segment.continuesFromPrev
        ? "rounded-l-none rounded-r-md"
        : segment.continuesToNext
          ? "rounded-l-md rounded-r-none"
          : "rounded-md";

  return (
    <div
      aria-hidden="true"
      data-slot="week-selection"
      className="pointer-events-none absolute inset-0 grid grid-cols-7 grid-rows-1"
    >
      <div
        style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}` }}
        className={`m-px bg-primary/10 ring-1 ring-primary/40 ring-inset ${corners}`}
      />
    </div>
  );
}
