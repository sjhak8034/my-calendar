import Link from "next/link";
import { formatFullDate, fillTemplate, isWeekend, type CalendarDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import { WeatherIcon } from "@/components/weather/weather-icon";
import { DayNoteIcon, type DayNoteLabels } from "@/components/calendar/day-note";
import type { Holiday } from "@/lib/holidays/ics";
import { cn } from "@/lib/utils";

type Props = {
  lang: Locale;
  date: CalendarDate;
  inMonth: boolean;
  isToday: boolean;
  eventCount: number;
  eventCountTemplate: string;
  note?: string; // 이 날짜의 메모(있으면 날짜 줄에 메모 아이콘)
  noteLabels: DayNoteLabels;
  holiday?: Holiday; // 쉬는 날은 날짜 숫자를 붉게, 이름은 날짜 줄 오른쪽에 작게(휴대폰은 이름 숨김)
};

// 날짜 칸 배경. 날짜 숫자 링크를 stretched link로 만들어 칸 전체를 클릭 영역으로 쓴다.
// 일정 칩은 오버레이에서 별도 링크로 위(z-10)에 올라온다. 날씨 아이콘은 날짜 숫자 옆에 둔다. data-date는 월간 기간 선택(끌기)이 칸의 날짜를 읽는 데 쓴다.
export function DayCell({
  lang,
  date,
  inMonth,
  isToday,
  eventCount,
  eventCountTemplate,
  holiday,
  note,
  noteLabels,
}: Props) {
  const full = formatFullDate(date, lang);
  const withHoliday = holiday ? `${full}, ${holiday.name}` : full;
  const label =
    eventCount > 0
      ? `${withHoliday}, ${fillTemplate(eventCountTemplate, { count: eventCount })}`
      : withHoliday;
  const day = Number(date.slice(8));

  return (
    <div
      role="gridcell"
      data-slot="day-cell"
      data-date={date}
      data-in-month={inMonth}
      data-today={isToday || undefined}
      className={cn(
        "relative min-h-[9.5rem] border-r border-b p-1.5 transition-colors last:border-r-0",
        // 이 주가 펼쳐지면(ExpandableWeek) 일정 줄 수에 맞춰 칸 높이가 늘어난다: 날짜 줄 2.25rem + 줄 높이 1.5rem + 줄 간격 0.25rem + 여백.
        "group-data-[expanded]/week:min-h-[calc(2.5rem+1.75rem*var(--week-rows))]",
        inMonth
          ? "bg-card hover:bg-muted/30"
          : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
      )}
    >
      <div className="flex items-center gap-1">
        <Link
          draggable={false}
          href={`/${lang}/day/${date}`}
          aria-label={label}
          aria-current={isToday ? "date" : undefined}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-medium outline-none [-webkit-touch-callout:none] sm:text-xs after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50",
            isToday && "bg-foreground text-background",
            !isToday && (isWeekend(date) || holiday?.kind === "holiday") && "text-destructive",
          )}
        >
          <time dateTime={date}>{day}</time>
        </Link>
        {/* 날짜 옆 날씨 아이콘(예보가 있는 날짜만). 칸 전체를 누르는 링크를 가리지 않도록 이벤트를 받지 않는다. 기온은 마우스를 올리면 보인다. */}
        <WeatherIcon date={date} showTitle className="pointer-events-none" />
        {holiday && (
          <span
            data-slot="holiday-name"
            className={cn(
              "pointer-events-none hidden min-w-0 truncate text-[10px] sm:inline",
              holiday.kind === "holiday" ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {holiday.name}
          </span>
        )}
        {/* 메모 아이콘은 칸 전체 링크 위(z-10)에 올라와 눌러서 메모 팝업을 연다. */}
        {note && <DayNoteIcon date={date} note={note} lang={lang} labels={noteLabels} />}
      </div>
    </div>
  );
}
