import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  eventDateSpan,
  fillTemplate,
  formatFullDate,
  formatHourLabel,
  formatShortDate,
  formatTime,
  formatTimeRange,
  formatWeekdayDay,
  normalizeEventColor,
  type CalendarDate,
  type DayTimeline,
  type EarlyEvent,
  type AllDayBar,
  type TimeBlock,
  type WeekTimeline,
} from "@/lib/calendar";
import { EventBlock, type EventBlockLabels } from "@/components/calendar/event-block";
import { NowLine } from "@/components/calendar/now-line";
import { ScrollToSelected } from "@/components/calendar/scroll-to-selected";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

export const START_HOUR = 6;
export const END_HOUR = 24;
const HOURS = END_HOUR - START_HOUR;
const RANGE_MINUTES = HOURS * 60;

type Props = {
  lang: Locale;
  weekDays: readonly CalendarDate[];
  timeline: WeekTimeline;
  descriptions: Record<string, string | null>; // 일정 id → 설명
  today: CalendarDate;
  selectedDate: CalendarDate;
  nowIso: string;
  dict: Dictionary["week"];
};

const ROW = "grid grid-cols-[var(--time-col)_repeat(7,minmax(0,1fr))]";
// 시간 눈금 열: 가로 스크롤해도 왼쪽에 고정. 비치지 않도록 카드 배경을 깐다.
const GUTTER = "sticky left-0 z-30 bg-card text-right text-[11px] text-muted-foreground";
const GUTTER_LABEL = "flex items-start justify-end pt-2.5 pr-2 leading-tight";
// 선택한 날짜 열의 옅은 배경
const SELECTED_BG = "data-selected:bg-muted/60";

// 주간 시간표. 카드 자체가 가로·세로 스크롤 컨테이너이고, 헤더/종일/6시 이전 줄은 위에 sticky로 붙는다.
// CSS 변수: --hour-h(시간당 높이), --time-col(시간 눈금 열 너비), --day-min(날짜 열 최소 너비)
export function WeekGrid({
  lang,
  weekDays,
  timeline,
  descriptions,
  today,
  selectedDate,
  nowIso,
  dict,
}: Props) {
  const labels: EventBlockLabels = {
    eventDetails: dict.eventDetails,
    close: dict.close,
    noDescription: dict.noDescription,
  };
  const hasEarly = timeline.days.some((day) => day.earlyEvents.length > 0);
  const hasAllDay = timeline.allDay.bars.length > 0;
  const headerId = (date: CalendarDate) => `week-day-${date}`;

  // 위/아래로 이어지는 일정은 스크린리더에도 알린다.
  const ariaLabel = (title: string, time: string, from = false, to = false) =>
    [
      fillTemplate(dict.eventLabel, { title, time }),
      from && dict.continuesFromPrevious,
      to && dict.continuesToNext,
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <div
      data-slot="week-grid"
      className="isolate overflow-hidden rounded-xl border bg-card shadow-xs [--day-min:6rem] [--hour-h:3.5rem] [--time-col:4rem]"
    >
      {/* 스크롤 영역 자체에 이름을 둔다. 안에 포커스 가능한 링크·버튼이 항상 있어 tabIndex는 두지 않는다.
          scroll-padding: 가로는 고정 눈금 열, 세로는 sticky 영역(상한 기준 폴백, 실제 높이는 ScrollToSelected가 갱신) */}
      <ScrollToSelected
        selectedDate={selectedDate}
        weekStart={weekDays[0]}
        role="group"
        aria-label={dict.gridLabel}
        className="max-h-[max(24rem,calc(100dvh-7rem))] scroll-pt-[16.5rem] scroll-pl-[var(--time-col)] overflow-auto lg:max-h-[max(28rem,calc(100dvh-15rem))]"
      >
        <div className="min-w-[calc(var(--time-col)+7*var(--day-min))]">
          {/* 위에 붙는 영역: 헤더 + 종일 + 6시 이전 */}
          <div data-slot="week-sticky" className="sticky top-0 z-40 bg-card">
            {/* 헤더 행 */}
            <div data-slot="week-header" className={cn(ROW, "border-b")}>
              <div data-slot="time-gutter" className={GUTTER} aria-hidden="true" />
              {weekDays.map((date) => {
                const isToday = date === today;
                const [weekday, dayNumber] = formatWeekdayDay(date).split(" ");
                return (
                  <div
                    key={date}
                    data-slot="week-header-cell"
                    data-selected={date === selectedDate || undefined}
                    data-today={isToday || undefined}
                    className={cn(
                      "flex border-l data-selected:shadow-[inset_0_-2px_0_0_var(--foreground)]",
                      SELECTED_BG,
                    )}
                  >
                    <Link
                      id={headerId(date)}
                      data-today={isToday || undefined}
                      href={`/${lang}/day/${date}`}
                      aria-label={
                        date === selectedDate
                          ? `${formatFullDate(date, lang)}, ${dict.selectedDay}`
                          : formatFullDate(date, lang)
                      }
                      aria-current={isToday ? "date" : undefined}
                      className="flex min-h-12 w-full items-center justify-center outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                    >
                      <span aria-hidden="true" className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground sm:text-[13px]">
                          {weekday}
                        </span>
                        <span
                          data-slot="day-number"
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                            isToday && "bg-foreground text-background",
                          )}
                        >
                          {dayNumber}
                        </span>
                      </span>
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* 종일 줄 */}
            <div data-slot="week-allday" className={cn(ROW, "border-b")}>
              <div data-slot="time-gutter" className={cn(GUTTER, GUTTER_LABEL)}>
                {dict.allDay}
              </div>
              {/* 막대가 많으면 이 줄 안에서만 세로 스크롤(상한 7rem) */}
              <div
                role="group"
                aria-label={dict.allDay}
                className="col-span-7 max-h-28 overflow-x-hidden overflow-y-auto [scrollbar-width:thin]"
              >
                <div
                  className={cn(
                    "relative grid grid-cols-7 content-start gap-y-0.5 py-1",
                    !hasAllDay && "min-h-8",
                  )}
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-7">
                    {weekDays.map((date) => (
                      <div
                        key={date}
                        data-selected={date === selectedDate || undefined}
                        className={cn("border-l", SELECTED_BG)}
                      />
                    ))}
                  </div>
                  {timeline.allDay.bars.map((bar) => (
                    <AllDayBarItem
                      key={bar.key}
                      bar={bar}
                      lang={lang}
                      description={descriptions[bar.id] ?? null}
                      labels={labels}
                      allDayEvent={dict.allDayEvent}
                      ariaLabel={ariaLabel}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 6시 이전 줄: 주 전체에 해당 일정이 없으면 생략 */}
            {hasEarly && (
              <div data-slot="week-early" className={cn(ROW, "border-b")}>
                <div data-slot="time-gutter" className={cn(GUTTER, GUTTER_LABEL)}>
                  {dict.earlyEvents}
                </div>
                {timeline.days.map((day) => (
                  <div
                    key={day.date}
                    data-selected={day.date === selectedDate || undefined}
                    className={cn(
                      "max-h-24 overflow-x-hidden overflow-y-auto border-l p-1 [scrollbar-width:thin]",
                      SELECTED_BG,
                    )}
                  >
                    {day.earlyEvents.length > 0 && (
                      <ol
                        aria-label={`${dict.earlyEvents}, ${formatFullDate(day.date, lang)}`}
                        className="m-0 flex list-none flex-col gap-1 p-0"
                      >
                        {day.earlyEvents.map((event) => (
                          <li key={event.key}>
                            <EarlyChip
                              event={event}
                              lang={lang}
                              description={descriptions[event.id] ?? null}
                              labels={labels}
                              ariaLabel={ariaLabel}
                            />
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 시간 눈금 + 날짜 열 */}
          <div
            data-slot="week-body"
            className={cn(ROW, "relative")}
            style={{ height: `calc(var(--hour-h) * ${HOURS})` }}
          >
            <div data-slot="time-gutter" aria-hidden="true" className={GUTTER}>
              {Array.from({ length: HOURS }, (_, i) => (
                <span
                  key={i}
                  data-slot="hour-label"
                  className={cn(
                    "absolute right-2 leading-none whitespace-nowrap",
                    i > 0 ? "-translate-y-1/2" : "translate-y-1",
                  )}
                  style={{ top: `${(i / HOURS) * 100}%` }}
                >
                  {formatHourLabel(START_HOUR + i, lang)}
                </span>
              ))}
            </div>

            {timeline.days.map((day) => (
              <DayColumn
                key={day.date}
                day={day}
                lang={lang}
                isSelected={day.date === selectedDate}
                isToday={day.date === today}
                headerId={headerId(day.date)}
                descriptions={descriptions}
                labels={labels}
                ariaLabel={ariaLabel}
              />
            ))}

            {/* 가로 눈금선 */}
            <div
              aria-hidden="true"
              data-slot="hour-lines"
              className="pointer-events-none absolute inset-y-0 right-0 left-[var(--time-col)]"
            >
              {Array.from({ length: HOURS }, (_, i) => (
                <div
                  key={i}
                  data-slot="hour-line"
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: `${(i / HOURS) * 100}%` }}
                />
              ))}
            </div>

            <NowLine
              nowIso={nowIso}
              weekDates={weekDays}
              startHour={START_HOUR}
              endHour={END_HOUR}
              locale={lang}
            />
          </div>
        </div>
      </ScrollToSelected>
    </div>
  );
}

type LabelFn = (title: string, time: string, from?: boolean, to?: boolean) => string;

function DayColumn({
  day,
  lang,
  isSelected,
  isToday,
  headerId,
  descriptions,
  labels,
  ariaLabel,
}: {
  day: DayTimeline;
  lang: Locale;
  isSelected: boolean;
  isToday: boolean;
  headerId: string;
  descriptions: Record<string, string | null>;
  labels: EventBlockLabels;
  ariaLabel: LabelFn;
}) {
  const blocks = [...day.blocks].sort((a, b) => a.top - b.top || a.column - b.column);
  return (
    <div
      role="group"
      aria-labelledby={headerId}
      data-slot="week-day"
      data-date={day.date}
      data-selected={isSelected || undefined}
      data-today={isToday || undefined}
      className={cn("relative border-l", SELECTED_BG)}
    >
      {blocks.length > 0 && (
        <ol className="m-0 list-none p-0">
          {blocks.map((block) => (
            <TimedBlock
              key={block.key}
              block={block}
              lang={lang}
              description={descriptions[block.id] ?? null}
              labels={labels}
              ariaLabel={ariaLabel}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimedBlock({
  block,
  lang,
  description,
  labels,
  ariaLabel,
}: {
  block: TimeBlock;
  lang: Locale;
  description: string | null;
  labels: EventBlockLabels;
  ariaLabel: LabelFn;
}) {
  const color = normalizeEventColor(block.color);
  const range = formatTimeRange(block.startAt, block.endAt, lang);
  const top = ((block.top - START_HOUR * 60) / RANGE_MINUTES) * 100;
  const height = ((block.bottom - block.top) / RANGE_MINUTES) * 100;
  const minutes = block.bottom - block.top;
  const twoLines = minutes >= 45;
  const clipped = block.clippedTop || block.clippedBottom;
  const timeText = twoLines && !block.clippedTop ? range : formatTime(block.startAt, lang);
  return (
    <li
      data-slot="week-event"
      className="absolute z-10 px-[3px] py-px"
      style={{
        top: `${top}%`,
        height: `${height}%`,
        left: `${(block.column / block.columnCount) * 100}%`,
        width: `${100 / block.columnCount}%`,
      }}
    >
      <EventBlock
        variant="block"
        title={block.title}
        color={color}
        when={range}
        description={description}
        labels={labels}
        aria-label={ariaLabel(block.title, range, block.clippedTop, block.clippedBottom)}
        data-clipped-top={block.clippedTop || undefined}
        data-clipped-bottom={block.clippedBottom || undefined}
        className={cn(
          twoLines ? "block py-1 leading-tight" : "flex items-center gap-1.5 py-0 leading-none",
          minutes < 30 && "text-[11px]",
          clipped ? "pr-4 pl-1.5" : "px-1.5",
          block.clippedTop && "rounded-t-none border-t-0",
          block.clippedBottom && "rounded-b-none border-b-0",
        )}
      >
        {block.clippedTop && (
          <ChevronUp
            aria-hidden="true"
            className="absolute top-0.5 right-1 size-3"
          />
        )}
        {block.clippedBottom && (
          <ChevronDown
            aria-hidden="true"
            className="absolute right-1 bottom-0.5 size-3"
          />
        )}
        <span
          data-slot="event-title"
          title={block.title}
          className={cn("block min-w-0 truncate font-semibold", !twoLines && "flex-1")}
        >
          {block.title}
        </span>
        {/* 낮은 블록은 시각을 제목 오른쪽에 두되, 겹쳐 폭이 좁으면 생략 */}
        {(twoLines || block.columnCount === 1) && (
          <span
            data-slot="event-time"
            className={cn(
              "block truncate font-normal",
              twoLines ? "mt-0.5 text-[11px]" : "shrink-0 text-[11px]",
            )}
          >
            {timeText}
          </span>
        )}
      </EventBlock>
    </li>
  );
}

function AllDayBarItem({
  bar,
  lang,
  description,
  labels,
  allDayEvent,
  ariaLabel,
}: {
  bar: AllDayBar;
  lang: Locale;
  description: string | null;
  labels: EventBlockLabels;
  allDayEvent: string;
  ariaLabel: LabelFn;
}) {
  const color = normalizeEventColor(bar.color);
  const span = eventDateSpan(bar.startAt, bar.endAt);
  const dates =
    span.start === span.end
      ? formatShortDate(span.start)
      : `${formatShortDate(span.start)} – ${formatShortDate(span.end)}`;
  return (
    <EventBlock
      variant="bar"
      title={bar.title}
      color={color}
      when={`${allDayEvent} · ${dates}`}
      description={description}
      labels={labels}
      aria-label={ariaLabel(
        bar.title,
        span.start === span.end
          ? allDayEvent
          : `${allDayEvent}, ${formatFullDate(span.start, lang)} – ${formatFullDate(span.end, lang)}`,
        bar.continuesFromPrev,
        bar.continuesToNext,
      )}
      data-continues-from-prev={bar.continuesFromPrev || undefined}
      data-continues-to-next={bar.continuesToNext || undefined}
      style={{
        gridColumn: `${bar.startCol + 1} / span ${bar.endCol - bar.startCol + 1}`,
        gridRow: bar.lane + 1,
      }}
      className={cn(
        "relative z-10",
        bar.continuesFromPrev ? "ml-0 rounded-l-none border-l-0" : "ml-0.5 rounded-l-md",
        bar.continuesToNext ? "mr-0 rounded-r-none border-r-0" : "mr-0.5 rounded-r-md",
      )}
    >
      <span
        data-slot="event-title"
        title={bar.title}
        className="min-w-0 flex-1 truncate font-semibold"
      >
        {bar.title}
      </span>
    </EventBlock>
  );
}

function EarlyChip({
  event,
  lang,
  description,
  labels,
  ariaLabel,
}: {
  event: EarlyEvent;
  lang: Locale;
  description: string | null;
  labels: EventBlockLabels;
  ariaLabel: LabelFn;
}) {
  const color = normalizeEventColor(event.color);
  const range = formatTimeRange(event.startAt, event.endAt, lang);
  return (
    <EventBlock
      variant="chip"
      title={event.title}
      color={color}
      when={range}
      description={description}
      labels={labels}
      aria-label={ariaLabel(event.title, range)}
    >
      <span
        data-slot="event-title"
        title={event.title}
        className="block w-full min-w-0 truncate font-semibold"
      >
        {event.title}
      </span>
      <span data-slot="event-time" className="block w-full truncate font-normal">
        {formatTime(event.startAt, lang)}
      </span>
    </EventBlock>
  );
}
