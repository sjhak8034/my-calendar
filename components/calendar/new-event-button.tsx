"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeekEditor } from "@/components/calendar/week-editor";
import type { CalendarDate } from "@/lib/calendar";

type Props = {
  date: CalendarDate; // 새 일정의 기본 날짜
  label: string;
  allDay?: boolean; // 월간 화면용: 그 날 하루짜리 종일 일정으로 연다(기간은 폼의 날짜에서 늘린다)
};

// "일정 추가" 버튼. 누르면 오른쪽 사이드바가 열린다. 주간은 그리드에 초안 블록이 생기고, 월간(allDay)은 종일 일정으로 열려 날짜 칸이 하이라이트된다.
export function NewEventButton({ date, label, allDay }: Props) {
  const { openCreate, openCreateRange } = useWeekEditor();
  return (
    <Button
      type="button"
      data-slot="new-event-button"
      variant="ghost"
      size="lg"
      className="bg-foreground px-4! text-background"
      onClick={() => (allDay ? openCreateRange(date, date) : openCreate(date))}
    >
      <Plus aria-hidden="true" />
      {label}
    </Button>
  );
}
