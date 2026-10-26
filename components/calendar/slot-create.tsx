"use client";

import { useWeekEditor } from "@/components/calendar/week-editor";
import type { CalendarDate } from "@/lib/calendar";

const SLOT_MINUTES = 30;

type Props = {
  date: CalendarDate;
  startHour: number;
  endHour: number;
};

// 날짜 열의 빈 곳을 누르면 그 시각(30분 단위로 내림)에 초안 블록을 놓고 사이드바를 연다.
// 마우스·터치용 보조 진입점이라 스크린리더에는 숨기고, 키보드는 툴바의 "일정 추가"를 쓴다.
export function SlotCreate({ date, startHour, endHour }: Props) {
  const { openCreate } = useWeekEditor();

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.height <= 0) return;
    const ratio = (event.clientY - rect.top) / rect.height;
    const range = (endHour - startHour) * 60;
    const offset = Math.floor((ratio * range) / SLOT_MINUTES) * SLOT_MINUTES;
    const minutes = startHour * 60 + Math.min(Math.max(offset, 0), range - SLOT_MINUTES);
    openCreate(date, minutes);
  }

  return (
    <div
      aria-hidden="true"
      data-slot="slot-create"
      onClick={handleClick}
      className="absolute inset-0 cursor-cell"
    />
  );
}
