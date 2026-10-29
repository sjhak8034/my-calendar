import Link from "next/link";
import { normalizeEventColor, formatTime } from "@/lib/calendar";
import { COLOR_CLASS } from "@/components/calendar/event-colors";
import type { Locale } from "@/lib/i18n/config";
import type { ChipSegment } from "@/lib/events/month-layout";
import { cn } from "@/lib/utils";

type Props = {
  lang: Locale;
  segment: ChipSegment & { lane: number };
  allDayLabel: string;
  collapsed?: boolean; // 3줄을 넘어 접힌 동안 숨기는 막대(주가 펼쳐지면 보인다)
};

// 일정 한 조각. 그리드 배치(grid-column/row)는 주 오버레이 안에서 style로 지정한다.
export function EventChip({ lang, segment, allDayLabel, collapsed }: Props) {
  const color = normalizeEventColor(segment.color);
  const { startCol, endCol, lane, continuesFromPrev, continuesToNext } = segment;
  const isTimed = !segment.allDay && segment.spanDays === 1;
  const time = isTimed ? formatTime(segment.startAt, lang) : null;
  const label = time
    ? `${segment.title}, ${time}`
    : segment.allDay
      ? `${segment.title}, ${allDayLabel}`
      : segment.title;

  return (
    <Link
      href={`/${lang}/day/${segment.startDate}`}
      data-slot="event-chip"
      draggable={false}
      data-event-id={segment.id}
      data-lane={lane}
      data-color={color}
      data-continues-from-prev={continuesFromPrev || undefined}
      data-continues-to-next={continuesToNext || undefined}
      title={label}
      aria-label={label}
      style={{
        gridColumn: `${startCol + 1} / span ${endCol - startCol + 1}`,
        gridRow: lane + 1,
      }}
      className={cn(
        "pointer-events-auto relative z-10 data-[dragging]:opacity-40 data-[lifted]:z-20 data-[lifted]:scale-105 data-[lifted]:shadow-lg [-webkit-touch-callout:none] min-w-0 items-center gap-1.5 border px-1 text-[11px] leading-none outline-none transition-[filter] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-2 sm:text-xs dark:hover:brightness-110",
        collapsed ? "hidden group-data-[expanded]/week:flex" : "flex",
        COLOR_CLASS[color],
        // 종일·여러 날 일정은 옅은 사선 무늬로 시간이 정해진 일정(무늬 없음)과 구분한다.
        isTimed ? "" : "event-hatch",
        continuesFromPrev ? "ml-0 rounded-l-none border-l-0" : "ml-0.5 rounded-l-md",
        continuesToNext ? "mr-0 rounded-r-none border-r-0" : "mr-0.5 rounded-r-md",
      )}
    >
      {/* 종일 막대의 진짜 시작·종료 쪽 끝: 마우스로 끌어 시작일·종료일을 바꾼다(주를 넘어 이어지는 쪽 끝은 제외). 터치는 끌기가 없다. */}
      {segment.allDay && !continuesFromPrev && (
        <span
          aria-hidden="true"
          data-handle="start"
          className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded-l-md hover:bg-foreground/15"
        />
      )}
      {segment.allDay && !continuesToNext && (
        <span
          aria-hidden="true"
          data-handle="end"
          className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize rounded-r-md hover:bg-foreground/15"
        />
      )}
      {/* leading-none인 막대 안에서 truncate(넘치면 숨김)가 한글 윗부분을 자르지 않도록 제목만 줄 높이를 넉넉히 둔다. */}
      <span className="min-w-0 flex-1 truncate leading-snug font-semibold">{segment.title}</span>
      {time && (
        <span className="hidden shrink-0 font-normal sm:inline">{time}</span>
      )}
    </Link>
  );
}
