import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatMonthParam,
  formatMonthShort,
  formatMonthTitle,
  formatPeriod,
  getAdjacentMonth,
  type CalendarDate,
} from "@/lib/calendar";
import { NewEventButton } from "@/components/calendar/new-event-button";
import { SEGMENT_CLASS } from "@/components/calendar/toolbar-styles";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Props = {
  lang: Locale;
  year: number;
  month: number;
  today: CalendarDate;
  monthStart: CalendarDate;
  monthEnd: CalendarDate;
  dict: Dictionary["calendar"];
};

// 날짜 배지(오늘), 월 제목 + 기간, 이전/오늘/다음, 일정 추가
export function CalendarToolbar({
  lang,
  year,
  month,
  today,
  monthStart,
  monthEnd,
  dict,
}: Props) {
  const prev = getAdjacentMonth(year, month, -1);
  const next = getAdjacentMonth(year, month, 1);
  const [, todayMonth, todayDay] = today.split("-").map(Number);
  const segment = SEGMENT_CLASS;
  return (
    <div
      data-slot="calendar-toolbar"
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
            {formatMonthTitle(year, month)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatPeriod(monthStart, monthEnd)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" className="flex items-center">
          <Link
            href={`/${lang}?month=${formatMonthParam(prev.year, prev.month)}`}
            aria-label={dict.previousMonth}
            className={`${segment} w-9 rounded-l-lg`}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/${lang}?month=${today.slice(0, 7)}`}
            className={`${segment} -ml-px px-4`}
          >
            {dict.today}
          </Link>
          <Link
            href={`/${lang}?month=${formatMonthParam(next.year, next.month)}`}
            aria-label={dict.nextMonth}
            className={`${segment} -ml-px w-9 rounded-r-lg`}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {/* 이 화면에서 바로 사이드바를 연다(오늘 하루짜리 종일 일정. 기간은 달력에서 끌어 고르거나 폼의 날짜로 늘린다). */}
        <NewEventButton date={today} label={dict.addEvent} allDay />
      </div>
    </div>
  );
}
