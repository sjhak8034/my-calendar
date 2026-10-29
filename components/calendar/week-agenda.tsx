"use client";

import { DOT_CLASS } from "@/components/calendar/event-colors";
import { useWeekEditor } from "@/components/calendar/week-editor";
import { useDayWeather } from "@/components/weather/weather-provider";
import {
  compareDates,
  eventDateSpan,
  formatFullDate,
  formatTimeRange,
  normalizeEventColor,
  type CalendarDate,
} from "@/lib/calendar";
import type { EditableEvent } from "@/lib/events/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Item = { event: EditableEvent; multiDay: boolean };

// 그 날짜와 겹치는 일정. 종일·여러 날 일정이 먼저, 그다음 시작 시각 순.
// 잘못된 날짜가 든 일정은 건너뛴다(그리드와 같은 기준, 서버 로그에 이미 남는다).
function itemsOn(date: CalendarDate, events: readonly EditableEvent[]): Item[] {
  const items: Item[] = [];
  for (const event of events) {
    try {
      const span = eventDateSpan(event.start_at, event.end_at);
      if (compareDates(span.start, date) <= 0 && compareDates(date, span.end) <= 0) {
        items.push({ event, multiDay: span.start !== span.end });
      }
    } catch {
      continue;
    }
  }
  const rank = (item: Item) => (item.event.all_day || item.multiDay ? 0 : 1);
  return items.sort((a, b) => rank(a) - rank(b) || a.event.start_at.localeCompare(b.event.start_at));
}

// 휴대폰 전용(sm 미만)으로 주간 그리드 아래에 두는, 선택한 날짜의 일정 목록.
// 좁은 열에는 제목이 2~3글자만 보여서, 읽을 수 있는 전체 제목·시간은 여기서 보여 준다. 항목을 누르면 수정 입력창이 열린다.
export function WeekAgenda({
  lang,
  selectedDate,
  events,
  dict,
}: {
  lang: Locale;
  selectedDate: CalendarDate;
  events: readonly EditableEvent[];
  dict: Dictionary["week"];
}) {
  const { openEdit } = useWeekEditor();
  const weather = useDayWeather(selectedDate);
  const items = itemsOn(selectedDate, events);

  return (
    <section
      data-slot="week-agenda"
      aria-label={dict.agendaLabel}
      className="-mx-3 border-y bg-card px-4 py-3 sm:hidden"
    >
      <h2 className="text-sm font-semibold">{formatFullDate(selectedDate, lang)}</h2>
      {weather && <p className="mt-0.5 text-xs text-muted-foreground">{weather.description}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{dict.noEventsOnDay}</p>
      ) : (
        <ul className="mt-2 flex list-none flex-col p-0">
          {items.map(({ event, multiDay }) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => openEdit(event)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-full ${DOT_CLASS[normalizeEventColor(event.color)]}`}
                />
                {/* 제목 아래 줄에 시간: 좁은 화면에서 긴 시간 범위("오전 9:00 – 오전 10:30")가 꺾이지 않게 한다. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-snug font-medium">{event.title}</span>
                  <span className="block truncate text-xs leading-snug tabular-nums text-muted-foreground">
                    {event.all_day && !multiDay ? dict.allDay : formatTimeRange(event.start_at, event.end_at, lang)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
