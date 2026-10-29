import Link from "next/link";
import { fillTemplate, type GridDay, type CalendarDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { WeekData } from "@/lib/events/month-layout";
import { DayCell } from "./day-cell";
import { EventChip } from "./event-chip";
import { WeekSelection } from "./week-selection";

type Props = {
  lang: Locale;
  days: GridDay[];
  today: CalendarDate;
  data: WeekData;
  dict: Dictionary["calendar"];
};

// 한 주: 7열 날짜 칸 배경 + 그 위에 pointer-events-none 오버레이 grid(일정 조각).
// 오버레이 행 높이는 고정(3줄 + "더 보기" 1줄)이라 lane → grid-row가 그대로 대응한다.
export function WeekRow({ lang, days, today, data, dict }: Props) {
  const { layout, eventCounts } = data;

  return (
    // 래퍼는 의미 없는 컨테이너. 실제 row는 날짜 칸만 감싼다.
    <div role="presentation" data-slot="week-row" className="relative last:[&_[data-slot=day-cell]]:border-b-0">
      <div role="row" className="grid grid-cols-7">
        {days.map((day, col) => (
          <DayCell
            key={day.date}
            lang={lang}
            date={day.date}
            inMonth={day.inMonth}
            isToday={day.date === today}
            eventCount={eventCounts[col]}
            eventCountTemplate={
              eventCounts[col] === 1 ? dict.eventCountOne : dict.eventCountOther
            }
          />
        ))}
      </div>
      {/* 기간 선택 하이라이트: 날짜 칸 위, 일정 칩 아래(별도 레이어라 칩의 줄 배치에 영향이 없다). */}
      <WeekSelection days={days.map((day) => day.date)} />
      <div
        role="presentation"
        data-slot="week-overlay"
        className="pointer-events-none absolute inset-x-0 top-9 grid grid-cols-7 grid-rows-[repeat(4,1.5rem)] gap-y-1"
      >
        {layout.placed
          .filter((segment) => segment.visible)
          .map((segment) => (
            <EventChip
              key={`${segment.id}-${segment.startCol}`}
              lang={lang}
              segment={segment}
              allDayLabel={dict.allDay}
            />
          ))}
        {layout.hiddenByDay.map((count, col) =>
          count > 0 ? (
            <Link
              key={col}
              href={`/${lang}/day/${days[col].date}`}
              data-slot="more-link"
              style={{ gridColumn: col + 1, gridRow: 4 }}
              className="pointer-events-auto relative z-10 mx-0.5 flex min-w-0 items-center truncate rounded px-1 text-[11px] text-muted-foreground outline-none hover:text-foreground hover:underline sm:px-2 sm:text-xs focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span aria-hidden="true" className="sm:hidden">
                +{count}
              </span>
              <span className="sr-only sm:not-sr-only sm:truncate">
                {fillTemplate(dict.moreEvents, { count })}
              </span>
            </Link>
          ) : null,
        )}
      </div>
    </div>
  );
}
