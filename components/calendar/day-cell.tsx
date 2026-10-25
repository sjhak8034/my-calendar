import Link from "next/link";
import { formatFullDate, fillTemplate, type CalendarDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type Props = {
  lang: Locale;
  date: CalendarDate;
  inMonth: boolean;
  isToday: boolean;
  eventCount: number;
  eventCountTemplate: string;
};

// 날짜 칸 배경. 날짜 숫자 링크를 stretched link로 만들어 칸 전체를 클릭 영역으로 쓴다.
// 일정 칩은 오버레이에서 별도 링크로 위(z-10)에 올라온다.
export function DayCell({
  lang,
  date,
  inMonth,
  isToday,
  eventCount,
  eventCountTemplate,
}: Props) {
  const full = formatFullDate(date, lang);
  const label =
    eventCount > 0
      ? `${full}, ${fillTemplate(eventCountTemplate, { count: eventCount })}`
      : full;
  const day = Number(date.slice(8));

  return (
    <div
      role="gridcell"
      data-slot="day-cell"
      data-in-month={inMonth}
      data-today={isToday || undefined}
      className={cn(
        "relative min-h-[9.5rem] border-r border-b p-1.5 transition-colors last:border-r-0",
        inMonth
          ? "bg-card hover:bg-muted/30"
          : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
      )}
    >
      <Link
        href={`/${lang}/day/${date}`}
        aria-label={label}
        aria-current={isToday ? "date" : undefined}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-medium outline-none sm:text-xs after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50",
          isToday && "bg-foreground text-background",
        )}
      >
        <time dateTime={date}>{day}</time>
      </Link>
    </div>
  );
}
