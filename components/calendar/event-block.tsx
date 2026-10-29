"use client";

import { type ComponentProps, type ReactNode } from "react";
import { COLOR_CLASS } from "@/components/calendar/event-colors";
import { useWeekEditor } from "@/components/calendar/week-editor";
import { eventDateSpan, toDayRange, GRID_START_HOUR, type DayRange, type EventColor } from "@/lib/calendar";
import { fromEvent, type EditableEvent } from "@/lib/events/input";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"button">, "color"> & {
  variant: "block" | "bar" | "chip";
  color: EventColor;
  event: EditableEvent; // 클릭하면 사이드바에서 수정한다
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

// 끌어 옮기거나 크기를 바꿀 수 있는 일정인지: 하루 안에 있고 06:00 이후에 시작하는 시간 일정
function draggableRange(event: EditableEvent): DayRange | null {
  if (event.all_day) return null;
  const range = toDayRange(fromEvent(event));
  return range && range.startMin >= GRID_START_HOUR * 60 ? range : null;
}

// 일정 하나를 버튼으로 그린다. 누르면 사이드바에서 수정하고,
// 하루 안의 시간 일정(block)은 끌어서 이동하고 위·아래 가장자리를 끌어 길이를 바꾼다.
export function EventBlock({
  variant,
  color,
  event,
  className,
  children,
  onClick,
  onPointerDown,
  ...buttonProps
}: Props) {
  const editor = useWeekEditor();
  const range = variant === "block" ? draggableRange(event) : null;
  // 종일·여러 날 일정은 월간 막대와 같은 옅은 사선 무늬로 시간이 정해진 일정(무늬 없음)과 구분한다.
  const span = eventDateSpan(event.start_at, event.end_at);
  const dateBased = event.all_day || span.start !== span.end;
  // 이 일정을 끌고 있는 동안 원래 자리에는 옅은 잔상만 남긴다. 놓으면 낙관적 업데이트로 이 블록 자체가
  // 새 위치에 그려지므로 따로 숨기거나 도착을 기다릴 필요가 없다.
  const dragging = editor.preview?.eventId === event.id && editor.dragging;

  return (
    <button
      {...buttonProps}
      type="button"
      data-slot="event-block"
      data-variant={variant}
      data-color={color}
      data-dragging={dragging || undefined}
      onClick={(e) => {
        onClick?.(e);
        // 끌기가 끝나며 생긴 click, 또는 마우스를 놓은 뒤의 중복 click은 건너뛴다.
        if (editor.consumeClick()) return;
        editor.openEdit(event);
      }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        // 터치는 스크롤과 겹치므로 본체 끌기는 마우스·펜만. 터치는 눌러서 사이드바로 수정한다.
        if (range && e.pointerType !== "touch") {
          editor.beginDrag(e, { kind: "event", event }, "move", range);
        }
      }}
      className={cn(
        "group cursor-pointer outline-none duration-150 motion-reduce:transition-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:brightness-110",
        VARIANT_CLASS[variant],
        COLOR_CLASS[color],
        dateBased && "event-hatch",
        range && "cursor-grab select-none active:cursor-grabbing",
        dragging ? "opacity-30 transition-[filter,opacity]" : "transition-[filter]",
        className,
      )}
    >
      {children}
      {range && (
        <>
          <span
            aria-hidden="true"
            data-slot="resize-handle"
            onPointerDown={(e) => {
              e.stopPropagation();
              editor.beginDrag(e, { kind: "event", event }, "start", range);
            }}
            className="absolute inset-x-0 top-0 z-10 h-2 cursor-ns-resize touch-none"
          >
            <span className="pointer-events-none absolute left-1/2 top-px h-[3px] w-7 -translate-x-1/2 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-40 group-focus-visible:opacity-40 motion-reduce:transition-none" />
          </span>
          <span
            aria-hidden="true"
            data-slot="resize-handle"
            onPointerDown={(e) => {
              e.stopPropagation();
              editor.beginDrag(e, { kind: "event", event }, "end", range);
            }}
            className="absolute inset-x-0 bottom-0 z-10 h-2 cursor-ns-resize touch-none"
          >
            <span className="pointer-events-none absolute left-1/2 bottom-px h-[3px] w-7 -translate-x-1/2 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-40 group-focus-visible:opacity-40 motion-reduce:transition-none" />
          </span>
        </>
      )}
    </button>
  );
}
