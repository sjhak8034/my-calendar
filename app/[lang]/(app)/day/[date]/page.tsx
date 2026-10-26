import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { WeekEditorProvider } from "@/components/calendar/week-editor";
import { WeekGrid } from "@/components/calendar/week-grid";
import { WeekToolbar } from "@/components/calendar/week-toolbar";
import {
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  buildWeekTimeline,
  getWeekDays,
  isValidDate,
  parseDate,
  todayInSeoul,
} from "@/lib/calendar";
import type { EditableEvent } from "@/lib/events/input";
import { getEventsForRange } from "@/lib/events/queries";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default function DayPage(props: PageProps<"/[lang]/day/[date]">) {
  // params와 현재 시각은 요청 시점 데이터이므로 Suspense 안에서 읽는다.
  return (
    <Suspense fallback={<WeekSkeleton />}>
      <WeekContent {...props} />
    </Suspense>
  );
}

const PAGE_CLASS = "mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 pb-10 sm:gap-5 sm:p-6 sm:pb-12 lg:p-8 lg:pb-12";

async function WeekContent({ params, searchParams }: PageProps<"/[lang]/day/[date]">) {
  const { lang, date } = await params;
  const { new: openNew } = await searchParams;
  if (!hasLocale(lang)) notFound();
  const parts = isValidDate(date) ? parseDate(date) : null;
  if (!parts || parts.year < CALENDAR_MIN_YEAR || parts.year > CALENDAR_MAX_YEAR) notFound();
  const dict = await getDictionary(lang);

  // 현재 시각은 요청 시점에만 읽는다(cacheComponents).
  await connection();
  const now = new Date();
  const nowIso = now.toISOString();
  const today = todayInSeoul(now);

  const weekDays = getWeekDays(date);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];

  const result = await getEventsForRange(weekStart, weekEnd, {
    includeDescription: true,
  });
  const events: EditableEvent[] = (result.ok ? result.events : []).map((event) => ({
    ...event,
    description: event.description ?? null,
  }));
  // 배치는 클라이언트에서(낙관적 업데이트를 반영해) 계산한다. 잘못된 데이터는 여기서 로그만 남긴다.
  const { skipped } = buildWeekTimeline(weekDays, events);
  if (skipped.length > 0) {
    // 잘못된 데이터는 화면에 노출하지 않고 서버 로그에만 남긴다.
    console.error("[week] skipped events:", skipped.join(", "));
  }

  return (
    <WeekEditorProvider
      labels={dict.eventForm}
      initialCreateDate={openNew === "1" ? date : undefined}
    >
    <main className={PAGE_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight sm:mb-1">
        {dict.week.title}
      </h1>
      <WeekToolbar
        lang={lang}
        selectedDate={date}
        weekStart={weekStart}
        weekEnd={weekEnd}
        today={today}
        dict={dict.calendar}
        weekDict={dict.week}
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
      <WeekGrid
        lang={lang}
        weekDays={weekDays}
        events={events}
        today={today}
        selectedDate={date}
        nowIso={nowIso}
        dict={dict.week}
      />
    </main>
    </WeekEditorProvider>
  );
}

function WeekSkeleton() {
  return (
    <main aria-busy="true" className={PAGE_CLASS}>
      <div aria-hidden="true" className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div aria-hidden="true" className="h-[4.75rem] animate-pulse rounded-xl border bg-card shadow-xs sm:h-[5.75rem]" />
      <div
        aria-hidden="true"
        className="grid h-[max(24rem,calc(100dvh-7rem))] grid-cols-[4rem_repeat(7,minmax(0,1fr))] grid-rows-[3rem_2rem_1fr] overflow-hidden rounded-xl border bg-card shadow-xs lg:h-[max(28rem,calc(100dvh-15rem))]"
      >
        <div className="col-span-8 grid grid-cols-subgrid border-b">
          <div />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center justify-center border-l">
              <div className="h-4 w-12 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="col-span-8 border-b" />
        <div className="col-span-8 grid grid-cols-subgrid">
          <div />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="border-l" />
          ))}
        </div>
      </div>
    </main>
  );
}
