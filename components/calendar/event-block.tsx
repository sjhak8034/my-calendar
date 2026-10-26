"use client";

import type { ComponentProps, ReactNode } from "react";
import { AlignLeft, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { COLOR_CLASS, DOT_CLASS } from "@/components/calendar/event-colors";
import type { EventColor } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export type EventBlockLabels = {
  eventDetails: string;
  close: string;
  noDescription: string;
};

type Props = Omit<ComponentProps<"button">, "title" | "color"> & {
  variant: "block" | "bar" | "chip";
  title: string;
  color: EventColor;
  when: string; // 대화상자에 보일 날짜·시간 문구(서버에서 포맷)
  description: string | null;
  labels: EventBlockLabels;
  children: ReactNode;
};

const VARIANT_CLASS = {
  // 시간 블록: 날짜 열 안에서 절대 위치 li를 가득 채운다(display·패딩은 호출 쪽에서 높이에 맞춰 지정).
  block: "relative size-full overflow-hidden rounded-md border text-left text-xs",
  // 종일 막대: 주 전체 그리드(grid-column/row는 style로 지정). 월간 막대와 같은 모양
  bar: "flex h-6 min-w-0 items-center border px-1 text-left text-[11px] leading-none sm:px-2 sm:text-xs",
  // 6시 이전 칩: 제목 + 시각 두 줄
  chip: "flex w-full min-w-0 flex-col items-start rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight",
} as const;

// 일정 하나를 버튼으로 그리고, 누르면 읽기 전용 상세 대화상자를 연다.
// 닫으면 base-ui가 포커스를 이 트리거로 돌려준다.
export function EventBlock({
  variant,
  title,
  color,
  when,
  description,
  labels,
  className,
  children,
  ...buttonProps
}: Props) {
  return (
    <Dialog>
      <DialogTrigger
        {...buttonProps}
        type="button"
        data-slot="event-block"
        data-variant={variant}
        data-color={color}
        className={cn(
          "cursor-pointer outline-none transition-[filter] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:brightness-110",
          VARIANT_CLASS[variant],
          COLOR_CLASS[color],
          className,
        )}
      >
        {children}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        data-slot="event-dialog"
        className="max-h-[calc(100dvh-2rem)] gap-0! overflow-hidden rounded-2xl! p-0! sm:max-w-md!"
      >
        <DialogHeader className="gap-3! p-5 pb-4">
          <DialogTitle className="flex items-start gap-2.5 text-lg! leading-snug! font-semibold! tracking-tight [overflow-wrap:anywhere]">
            <span
              aria-hidden="true"
              data-slot="event-dialog-dot"
              data-color={color}
              className={cn("mt-2 size-3 shrink-0 rounded-full", DOT_CLASS[color])}
            />
            <span className="min-w-0">{title}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {labels.eventDetails}
          </DialogDescription>
          <p
            data-slot="event-dialog-when"
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{when}</span>
          </p>
        </DialogHeader>
        <div className="flex min-h-0 items-start gap-2 px-5 pb-5 text-sm">
          <AlignLeft className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p
            data-slot="event-dialog-description"
            className={cn(
              "max-h-[40dvh] min-w-0 flex-1 overflow-y-auto leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]",
              !description && "text-muted-foreground",
            )}
          >
            {description || labels.noDescription}
          </p>
        </div>
        <DialogFooter className="mx-0! mb-0! rounded-b-2xl! px-5! py-3!">
          <DialogClose render={<Button variant="outline" />}>
            {labels.close}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
