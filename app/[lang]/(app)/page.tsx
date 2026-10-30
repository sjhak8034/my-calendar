import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { MonthGrid } from "@/components/calendar/month-grid";
import { MonthSelect } from "@/components/calendar/month-select";
import { WeekEditorProvider } from "@/components/calendar/week-editor";
import { WeatherCredit } from "@/components/weather/weather-icon";
import {
  endOfMonth,
  formatDate,
  formatMonthParam,
  getMonthGrid,
  parseMonthParam,
  startOfMonth,
  todayInSeoul,
} from "@/lib/calendar";
import type { EditableEvent } from "@/lib/events/input";
import { getEventsForRange } from "@/lib/events/queries";
import { getHolidaysForDates } from "@/lib/holidays";
import { getNotesForRange } from "@/lib/notes/queries";
import { buildMonthLayout } from "@/lib/events/month-layout";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default function HomePage(props: PageProps<"/[lang]">) {
  // params/searchParams/쿠키/현재 시각은 요청 시점 데이터이므로 Suspense 안에서 읽는다.
  return (
    <Suspense fallback={<MonthSkeleton />}>
      <MonthContent {...props} />
    </Suspense>
  );
}

const PAGE_CLASS = "mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 pb-10 sm:gap-5 sm:p-6 sm:pb-12 lg:p-8 lg:pb-12";

async function MonthContent({ params, searchParams }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { month: monthParam } = await searchParams;
  const dict = await getDictionary(lang);

  // 현재 시각은 요청 시점에만 읽는다(cacheComponents).
  await connection();
  const today = todayInSeoul(new Date());

  const parsed = parseMonthParam(
    typeof monthParam === "string" ? monthParam : undefined,
  );
  // 홈 주소(/ko)나 잘못된 month 값은 오늘이 속한 달의 ?month=로 통일한다.
  if (!parsed) {
    const [todayYear, todayMonth] = today.split("-").map(Number);
    redirect(`/${lang}?month=${formatMonthParam(todayYear, todayMonth)}`);
  }
  const { year, month } = parsed;

  const grid = getMonthGrid(year, month);
  const gridStart = grid[0][0].date;
  const gridEnd = grid[grid.length - 1][6].date;
  const monthFirst = formatDate({ year, month, day: 1 });

  // 월간에서도 일정을 눌러 수정하므로 설명까지 가져온다(수정 폼이 설명을 그대로 보여 주고 저장해야 해서 자르지 않는다).
  // 일정과 휴일을 함께 가져온다(휴일은 길게 캐시돼 있어 대부분 바로 돌아온다).
  const [result, holidays, notesResult] = await Promise.all([
    getEventsForRange(gridStart, gridEnd, { includeDescription: true }),
    getHolidaysForDates([gridStart, gridEnd], lang),
    getNotesForRange(gridStart, gridEnd),
  ]);
  const monthEvents = result.ok ? result.events : [];
  const weeks = buildMonthLayout(grid, monthEvents);
  const editableEvents: EditableEvent[] = monthEvents.map((event) => ({
    ...event,
    description: event.description ?? null,
  }));

  return (
    // 월간 화면에서도 일정 입력창(사이드바)을 연다: 날짜 칸을 끌어 기간을 고르거나 툴바의 "일정 추가".
    <WeekEditorProvider labels={dict.eventForm} hint={dict.eventForm.rangeHint} hintEdit="">
    <main className={PAGE_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight sm:mb-1">
        {dict.calendar.title}
      </h1>
      <CalendarToolbar
        lang={lang}
        year={year}
        month={month}
        today={today}
        monthStart={startOfMonth(monthFirst)}
        monthEnd={endOfMonth(monthFirst)}
        dict={dict.calendar}
      />
      {!result.ok && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {dict.calendar.loadFailed}
        </p>
      )}
      {result.ok && result.truncated && (
        <p role="status" className="text-xs text-muted-foreground">
          {dict.calendar.truncated}
        </p>
      )}
      <MonthSelect events={editableEvents}>
        <MonthGrid
          lang={lang}
          grid={grid}
          weeks={weeks}
          today={today}
          dict={dict.calendar}
          holidays={holidays}
          notes={notesResult.notes}
          noteLabels={dict.dayNote}
        />
      </MonthSelect>
      <WeatherCredit />
    </main>
    </WeekEditorProvider>
  );
}

function MonthSkeleton() {
  return (
    <main aria-busy="true" className={PAGE_CLASS}>
      <div aria-hidden="true" className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div aria-hidden="true" className="h-[4.75rem] animate-pulse rounded-xl border bg-card sm:h-[5.75rem]" />
      <div
        aria-hidden="true"
        className="grid grid-cols-7 overflow-hidden rounded-xl border bg-card shadow-xs"
      >
        {Array.from({ length: 42 }, (_, i) => (
          <div key={i} className="min-h-[9.5rem] border-r border-b [&:nth-child(7n)]:border-r-0" />
        ))}
      </div>
    </main>
  );
}
