import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  formatMonthParam,
  formatMonthShort,
  formatMonthTitle,
  formatPeriod,
  getAdjacentMonth,
  type CalendarDate,
} from "@/lib/calendar";
import { SEGMENT_CLASS } from "@/components/calendar/toolbar-styles";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
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
            href={`/${lang}`}
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
        {/* 오늘이 속한 주간 화면으로 가서 사이드바를 연 채 시작한다. */}
        <Link
          href={`/${lang}/day/${today}?new=1`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "lg" }),
            "bg-foreground px-4! text-background",
          )}
        >
          <Plus aria-hidden="true" />
          {dict.addEvent}
        </Link>
      </div>
    </div>
  );
}
