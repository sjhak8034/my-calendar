"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeekEditor } from "@/components/calendar/week-editor";
import type { CalendarDate } from "@/lib/calendar";

type Props = {
  date: CalendarDate; // 새 일정의 기본 날짜
  label: string;
};

// 주간 툴바의 "일정 추가" 버튼. 누르면 오른쪽 사이드바가 열리고 그리드에 초안 블록이 생긴다.
export function NewEventButton({ date, label }: Props) {
  const { openCreate } = useWeekEditor();
  return (
    <Button
      type="button"
      data-slot="new-event-button"
      variant="ghost"
      size="lg"
      className="bg-foreground px-4! text-background"
      onClick={() => openCreate(date)}
    >
      <Plus aria-hidden="true" />
      {label}
    </Button>
  );
}
