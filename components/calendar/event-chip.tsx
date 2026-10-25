import Link from "next/link";
import { normalizeEventColor, formatTime, type EventColor } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { ChipSegment } from "@/lib/events/month-layout";
import { cn } from "@/lib/utils";

// 팔레트 키 → 클래스. Tailwind가 정적으로 찾을 수 있게 전체 클래스를 그대로 적는다.
const COLOR_CLASS: Record<EventColor, string> = {
  gray: "border-event-gray-border bg-event-gray-bg text-event-gray-fg",
  blue: "border-event-blue-border bg-event-blue-bg text-event-blue-fg",
  indigo: "border-event-indigo-border bg-event-indigo-bg text-event-indigo-fg",
  purple: "border-event-purple-border bg-event-purple-bg text-event-purple-fg",
  pink: "border-event-pink-border bg-event-pink-bg text-event-pink-fg",
  orange: "border-event-orange-border bg-event-orange-bg text-event-orange-fg",
  yellow: "border-event-yellow-border bg-event-yellow-bg text-event-yellow-fg",
  green: "border-event-green-border bg-event-green-bg text-event-green-fg",
};

type Props = {
  lang: Locale;
  segment: ChipSegment & { lane: number };
  allDayLabel: string;
};

// 일정 한 조각. 그리드 배치(grid-column/row)는 주 오버레이 안에서 style로 지정한다.
export function EventChip({ lang, segment, allDayLabel }: Props) {
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
        "pointer-events-auto relative z-10 flex min-w-0 items-center gap-1.5 border px-1 text-[11px] leading-none outline-none transition-[filter] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-2 sm:text-xs dark:hover:brightness-110",
        COLOR_CLASS[color],
        continuesFromPrev ? "ml-0 rounded-l-none border-l-0" : "ml-0.5 rounded-l-md",
        continuesToNext ? "mr-0 rounded-r-none border-r-0" : "mr-0.5 rounded-r-md",
      )}
    >
      <span className="min-w-0 flex-1 truncate font-semibold">{segment.title}</span>
      {time && (
        <span className="hidden shrink-0 font-normal sm:inline">{time}</span>
      )}
    </Link>
  );
}
