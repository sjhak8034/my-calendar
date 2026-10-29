"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeekEditor } from "@/components/calendar/week-editor";
import { cn } from "@/lib/utils";
import type { CalendarDate } from "@/lib/calendar";

type Props = {
  date: CalendarDate; // 새 일정의 기본 날짜
  label: string;
  allDay?: boolean; // 월간 화면용: 그 날 하루짜리 종일 일정으로 연다(기간은 폼의 날짜에서 늘린다)
  compact?: boolean; // 휴대폰(sm 미만)에서 툴바 한 줄에 들어가도록 작게(아이콘 숨김, 남는 폭을 나눠 가짐). sm부터는 기본 모양
};

// "일정 추가" 버튼. 누르면 오른쪽 사이드바가 열린다. 주간은 그리드에 초안 블록이 생기고, 월간(allDay)은 종일 일정으로 열려 날짜 칸이 하이라이트된다.
export function NewEventButton({ date, label, allDay, compact }: Props) {
  const { openCreate, openCreateRange } = useWeekEditor();
  return (
    <Button
      type="button"
      data-slot="new-event-button"
      variant="ghost"
      size="lg"
      className={cn(
        "bg-foreground px-4! text-background",
        compact && "max-sm:min-w-0 max-sm:flex-1 max-sm:px-2! max-sm:text-[13px] max-sm:[&>svg]:hidden",
      )}
      onClick={() => (allDay ? openCreateRange(date, date) : openCreate(date))}
    >
      <Plus aria-hidden="true" />
      {label}
    </Button>
  );
}
