"use client";

import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  dayPiece,
  formatClockRange,
  normalizeEventColor,
  toDayRange,
  type CalendarDate,
  type DayRange,
} from "@/lib/calendar";
import { COLOR_CLASS } from "@/components/calendar/event-colors";
import { useWeekEditor } from "@/components/calendar/week-editor";
import { MIN_BLOCK_MINUTES, blockStyle, resizingStyle } from "@/components/calendar/block-geometry";
import { BlockText } from "@/components/calendar/block-text";
import { cn } from "@/lib/utils";

// 날짜 열 위에 얹는 임시 블록: 사이드바의 초안 일정, 끌고 있는 저장된 일정의 새 위치.
export function DayOverlay({ date }: { date: CalendarDate }) {
  const { panel, preview, floating, dragInfo, labels, beginDrag } = useWeekEditor();
  const dragging = !!dragInfo;
  const resizing =
    dragInfo && dragInfo.mode !== "move"
      ? { kind: dragInfo.kind, mode: dragInfo.mode, base: dragInfo.base }
      : null;
  const draft = panel?.mode === "create" && !panel.values.allDay ? panel.values : null;
  const piece = draft ? dayPiece(draft, date) : null;
  const draftRange = draft ? toDayRange(draft) : null;
  const range = GRID_START_HOUR * 60;
  const limit = GRID_END_HOUR * 60;

  return (
    <>
      {/* 옮기는 동안 지금 놓으면 들어갈 날짜 열을 옅게 강조 */}
      {floating && floating.date === date && (
        <div
          aria-hidden="true"
          data-slot="drop-column"
          className="pointer-events-none absolute inset-0 z-[5] bg-foreground/[0.06] ring-1 ring-foreground/20 ring-inset transition-opacity"
        />
      )}
      {draft && piece && (
        <DraftPiece
          startMin={piece.startMin}
          endMin={piece.endMin}
          color={draft.color}
          title={draft.title.trim() || labels.draftTitle}
          dragging={dragging}
          resizeBase={resizing?.kind === "draft" ? resizing : null}
          placeholder={!!floating}
          // 하루 안에 있는 초안만 끌 수 있다(여러 날은 사이드바 입력으로).
          range={draftRange && draftRange.date === date ? draftRange : null}
          resizeTop={labels.resizeTop}
          resizeBottom={labels.resizeBottom}
          onDragStart={(e, mode, r) => beginDrag(e, { kind: "draft" }, mode, r)}
        />
      )}
      {preview && preview.range.date === date && (
        <div
          aria-hidden="true"
          data-slot="drag-preview"
          data-drag-surface="event"
          className={cn(
            "pointer-events-none absolute inset-x-[3px] z-30 overflow-hidden rounded-md border px-1.5 py-0 text-xs ring-2 ring-foreground/30",
            // 끄는 동안은 포인터에 바로 붙고, 놓은 뒤에만 15분 칸으로 미끄러져 안착한다.
            !dragging && "transition-[top,height,box-shadow] duration-150 ease-out motion-reduce:transition-none",
            floating
              ? // 떠 있는 블록이 따로 있으면 이 자리는 놓일 곳을 알리는 옅은 틀
                "border-dashed border-foreground/40 bg-foreground/10 shadow-none"
              : cn(
                  dragging ? "shadow-xl" : "shadow-md",
                  COLOR_CLASS[normalizeEventColor(preview.color)],
                ),
          )}
          style={
            resizing?.kind === "event"
              ? resizingStyle(resizing.mode, resizing.base, range, limit)
              : blockStyle(preview.range.startMin, preview.range.endMin, range, limit)
          }
        >
          {!floating && (
            <BlockText
              title={preview.title}
              time={formatClockRange(preview.range.startMin, preview.range.endMin)}
              minutes={preview.range.endMin - preview.range.startMin}
            />
          )}
        </div>
      )}
    </>
  );
}

function DraftPiece({
  startMin,
  endMin,
  color,
  title,
  dragging,
  resizeBase,
  placeholder,
  range,
  resizeTop,
  resizeBottom,
  onDragStart,
}: {
  startMin: number;
  endMin: number;
  color: string;
  title: string;
  dragging: boolean;
  resizeBase: { mode: "start" | "end"; base: DayRange } | null; // 크기 조절 중이면 시작 범위로 고정
  placeholder: boolean; // 떠 있는 블록이 따로 있을 때: 놓일 자리를 옅게 표시
  range: DayRange | null;
  resizeTop: string;
  resizeBottom: string;
  onDragStart: (
    e: React.PointerEvent,
    mode: "move" | "start" | "end",
    range: DayRange,
  ) => void;
}) {
  const from = Math.max(startMin, GRID_START_HOUR * 60);
  const to = Math.min(Math.max(endMin, from + MIN_BLOCK_MINUTES), GRID_END_HOUR * 60);
  if (from >= GRID_END_HOUR * 60) return null;
  const draggable = range !== null;
  return (
    <div
      data-slot="draft-block"
      data-drag-surface="draft"
      data-color={normalizeEventColor(color)}
      onPointerDown={draggable ? (e) => onDragStart(e, "move", range) : undefined}
      className={cn(
        "absolute inset-x-[3px] z-20 overflow-hidden rounded-md border-2 border-dashed px-1.5 py-0 text-xs opacity-90 select-none",
        // 끄는 동안은 포인터에 바로 붙고, 놓은 뒤·시간 입력 변경 시에만 미끄러진다.
        !resizeBase && !dragging && "transition-[top,height,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        dragging ? "shadow-xl" : "shadow-md",
        placeholder && "border-foreground/40 bg-foreground/10 text-transparent opacity-100 shadow-none",
        !placeholder && COLOR_CLASS[normalizeEventColor(color)],
        draggable && "cursor-grab touch-none active:cursor-grabbing",
      )}
      style={
        resizeBase
          ? resizingStyle(resizeBase.mode, resizeBase.base, GRID_START_HOUR * 60, GRID_END_HOUR * 60)
          : blockStyle(from, to, GRID_START_HOUR * 60, GRID_END_HOUR * 60)
      }
    >
      {draggable && (
        <>
          <span
            aria-hidden="true"
            title={resizeTop}
            onPointerDown={(e) => {
              e.stopPropagation();
              onDragStart(e, "start", range);
            }}
            className="absolute inset-x-0 top-0 z-10 h-2 cursor-ns-resize touch-none"
          >
            <span className="pointer-events-none absolute top-px left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-current opacity-40" />
          </span>
          <span
            aria-hidden="true"
            title={resizeBottom}
            onPointerDown={(e) => {
              e.stopPropagation();
              onDragStart(e, "end", range);
            }}
            className="absolute inset-x-0 bottom-0 z-10 h-2 cursor-ns-resize touch-none"
          >
            <span className="pointer-events-none absolute bottom-px left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-current opacity-40" />
          </span>
        </>
      )}
      <BlockText
        title={title}
        time={formatClockRange(startMin, endMin)}
        minutes={endMin - startMin}
      />
    </div>
  );
}
