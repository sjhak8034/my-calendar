import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  addDays,
  formatMonthParam,
  formatMonthShort,
  formatPeriod,
  formatWeekTitle,
  parseDate,
  type CalendarDate,
} from "@/lib/calendar";
import { SEGMENT_CLASS } from "@/components/calendar/toolbar-styles";
import { NewEventButton } from "@/components/calendar/new-event-button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Props = {
  lang: Locale;
  selectedDate: CalendarDate;
  weekStart: CalendarDate;
  weekEnd: CalendarDate;
  today: CalendarDate;
  dict: Dictionary["calendar"];
  weekDict: Dictionary["week"];
};

// 범위 밖으로 이동할 수 없을 때: 같은 모양, 클릭·포커스 불가
const DISABLED_CLASS = "pointer-events-none cursor-not-allowed opacity-50";

// 날짜 배지(오늘), 주 제목 + 기간, 이전 주/오늘/다음 주, 월간 보기, 일정 추가
export function WeekToolbar({
  lang,
  selectedDate,
  weekStart,
  weekEnd,
  today,
  dict,
  weekDict,
}: Props) {
  const [, todayMonth, todayDay] = today.split("-").map(Number);
  const selected = parseDate(selectedDate);
  const inRange = (date: CalendarDate) => {
    const parts = parseDate(date);
    return !!parts && parts.year >= CALENDAR_MIN_YEAR && parts.year <= CALENDAR_MAX_YEAR;
  };
  const prevWeek = addDays(selectedDate, -7);
  const nextWeek = addDays(selectedDate, 7);
  const monthHref = selected
    ? `/${lang}?month=${formatMonthParam(selected.year, selected.month)}`
    : `/${lang}`;
  return (
    <div
      data-slot="week-toolbar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs sm:p-4"
    >
      <div className="flex items-center gap-3">
        <div
          data-slot="date-badge"
          className="flex w-14 flex-col items-center rounded-lg border bg-card py-1 leading-tight shadow-xs"
        >
          <span className="text-[11px] text-muted-foreground">
            {formatMonthShort(todayMonth)}
          </span>
          <span className="text-lg font-semibold leading-none">{todayDay}</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {formatWeekTitle(weekStart, weekEnd)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatPeriod(weekStart, weekEnd)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" className="flex items-center">
          {inRange(prevWeek) ? (
            <Link
              href={`/${lang}/day/${prevWeek}`}
              aria-label={weekDict.previousWeek}
              className={`${SEGMENT_CLASS} w-9 rounded-l-lg`}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span
              role="link"
              aria-disabled="true"
              aria-label={weekDict.previousWeek}
              className={`${SEGMENT_CLASS} ${DISABLED_CLASS} w-9 rounded-l-lg`}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </span>
          )}
          <Link href={`/${lang}/day/${today}`} className={`${SEGMENT_CLASS} -ml-px px-4`}>
            {dict.today}
          </Link>
          {inRange(nextWeek) ? (
            <Link
              href={`/${lang}/day/${nextWeek}`}
              aria-label={weekDict.nextWeek}
              className={`${SEGMENT_CLASS} -ml-px w-9 rounded-r-lg`}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span
              role="link"
              aria-disabled="true"
              aria-label={weekDict.nextWeek}
              className={`${SEGMENT_CLASS} ${DISABLED_CLASS} -ml-px w-9 rounded-r-lg`}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          )}
        </div>
        <Link
          href={monthHref}
          data-slot="month-view-link"
          className={`${SEGMENT_CLASS} gap-1.5 rounded-lg px-3`}
        >
          <CalendarDays className="size-4" aria-hidden="true" />
          {weekDict.monthView}
        </Link>
        <NewEventButton date={selectedDate} label={dict.addEvent} />
      </div>
    </div>
  );
}
