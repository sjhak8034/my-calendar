"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  fillTemplate,
  formatFullDate,
  formatHourLabel,
  formatTime,
  formatTimeRange,
  formatWeekdayDay,
  normalizeEventColor,
  type CalendarDate,
  type DayTimeline,
  type EarlyEvent,
  type TimeBlock,
  buildWeekTimeline,
} from "@/lib/calendar";
import { isTwoLine } from "@/components/calendar/block-text";
import { DayOverlay } from "@/components/calendar/day-overlay";
import { EventBlock } from "@/components/calendar/event-block";
import { SlotCreate } from "@/components/calendar/slot-create";
import { NowLine } from "@/components/calendar/now-line";
import { ScrollToSelected } from "@/components/calendar/scroll-to-selected";
import { useWeekEditor } from "@/components/calendar/week-editor";
import { WeatherIcon } from "@/components/weather/weather-icon";
import { useDayWeather } from "@/components/weather/weather-provider";
import { applyRange, type EditableEvent } from "@/lib/events/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

const START_HOUR = GRID_START_HOUR;
const END_HOUR = GRID_END_HOUR;
const HOURS = END_HOUR - START_HOUR;
const RANGE_MINUTES = HOURS * 60;

type Props = {
  lang: Locale;
  weekDays: readonly CalendarDate[];
  events: readonly EditableEvent[]; // 서버에서 받은 이 주의 일정
  today: CalendarDate;
  selectedDate: CalendarDate;
  nowIso: string;
  dict: Dictionary["week"];
};

const ROW = "grid grid-cols-[var(--time-col)_repeat(7,minmax(0,1fr))]";
// 시간 눈금 열: 가로 스크롤해도 왼쪽에 고정. 비치지 않도록 카드 배경을 깐다.
const GUTTER = "sticky left-0 z-30 bg-card text-right text-[10px] text-muted-foreground sm:text-[11px]";
const GUTTER_LABEL = "flex items-start justify-end pt-2.5 pr-1 leading-tight break-keep sm:pr-2";
// 선택한 날짜 열의 옅은 배경
const SELECTED_BG = "data-selected:bg-muted/60";

// 요일 머리글 링크의 id(날짜 열이 aria-labelledby로 가리킨다).
const headerId = (date: CalendarDate) => `week-day-${date}`;

// 요일 머리글 한 칸: 윗줄은 "날씨 아이콘 요일 날짜", 아랫줄은 작은 기온(최저 / 최고).
// 날씨가 없는 칸도 아랫줄 높이를 비워 두어, 날씨가 늦게 도착해도 머리글 높이가 변하지 않는다.
function WeekHeaderLink({
  lang,
  date,
  isToday,
  isSelected,
  selectedDayLabel,
}: {
  lang: Locale;
  date: CalendarDate;
  isToday: boolean;
  isSelected: boolean;
  selectedDayLabel: string;
}) {
  const weather = useDayWeather(date);
  const [weekday, dayNumber] = formatWeekdayDay(date).split(" ");
  const full = formatFullDate(date, lang);
  const name = isSelected ? `${full}, ${selectedDayLabel}` : full;
  return (
    <Link
      id={headerId(date)}
      data-today={isToday || undefined}
      href={`/${lang}/day/${date}`}
      aria-label={weather ? `${name}, ${weather.description}` : name}
      aria-current={isToday ? "date" : undefined}
      className="flex min-h-[4.75rem] w-full flex-col items-center justify-start gap-0.5 pt-1.5 outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:min-h-14 sm:justify-center sm:pt-0"
    >
      {/* 휴대폰(열이 좁음)은 세로로 쌓는다: 요일, 날짜, 날씨 아이콘, 붙여 쓴 최저/최고 기온("7°/18°"). sm부터는 한 줄 + 아래 "7° / 18°". */}
      <span aria-hidden="true" className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
        <span className="order-last sm:order-none">
          <WeatherIcon date={date} className="sm:size-4" />
        </span>
        <span className="text-[10px] font-medium text-muted-foreground sm:text-[13px]">{weekday}</span>
        <span
          data-slot="day-number"
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-semibold sm:size-7 sm:text-sm",
            isToday && "bg-foreground text-background",
          )}
        >
          {dayNumber}
        </span>
      </span>
      <span data-slot="week-temps" aria-hidden="true" className="h-3 text-[10px] leading-3 whitespace-nowrap text-muted-foreground">
        {weather && (
          <>
            <span className="tracking-tighter sm:hidden">{`${weather.tempMin}°/${weather.tempMax}°`}</span>
            <span className="hidden sm:inline">{weather.temps}</span>
          </>
        )}
      </span>
    </Link>
  );
}

// 주간 시간표. 카드 자체가 가로·세로 스크롤 컨테이너이고, 헤더/6시 이전 줄은 위에 sticky로 붙는다(종일 일정은 주간에서 보여 주지 않는다).
// CSS 변수: --hour-h(시간당 높이), --time-col(시간 눈금 열 너비), --day-min(날짜 열 최소 너비)
export function WeekGrid({
  lang,
  weekDays,
  events,
  today,
  selectedDate,
  nowIso,
  dict,
}: Props) {
  // 낙관적 업데이트: 아직 서버에 반영 중인 새 위치를 덮어쓴 일정으로 배치를 계산한다.
  const { overrides, removed, reconcile } = useWeekEditor();
  const { timeline, eventsById } = useMemo(() => {
    const effective = events
      .filter((event) => !(event.id in removed))
      .map((event) => {
        const override = overrides[event.id];
        return override ? applyRange(event, override.range) : event;
      });
    const byId: Record<string, EditableEvent> = {};
    for (const event of effective) byId[event.id] = event;
    return { timeline: buildWeekTimeline(weekDays, effective), eventsById: byId };
  }, [events, overrides, removed, weekDays]);
  // 서버 데이터가 덮어쓴 위치와 같아지면 덮어쓰기를 걷는다.
  useEffect(() => {
    reconcile(events);
  }, [events, reconcile]);

  const hasEarly = timeline.days.some((day) => day.earlyEvents.length > 0);

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
      // 휴대폰의 시간당 높이(--hour-h)는 "한 화면에 딱 맞는 높이"(화면 높이 - 위쪽 고정 영역 23.375rem을 18시간으로 나눔)의 2배다(사용자 요청). 그래서 그리드 안에서 세로로 스크롤하고, 머리글은 sticky로 남는다. 23.375rem·18은 상단 바·툴바·머리글 높이와 HOURS에서 온 값이라 그 높이가 바뀌면 함께 고친다.
      // (아래 설명은 이전의 한 화면 맞춤 방식) 휴대폰은 7일·06~24시가 스크롤 없이 한 화면에 보이게 했다: 열 최소 너비를 없애고, 눈금 열을 좁히고, 카드를 화면 가장자리까지 넓히고,
      // 페이지가 정해 준 남은 높이를 카드가 flex로 채우며 시간 눈금 본문(week-body)이 머리글·6시 이전 줄을 뺀 나머지를 모두 차지한다(시간 간격이 자동으로 맞춰지고, 최소 0.875rem이라 아주 작은 화면에서 6시 이전 줄이 있을 때만 그리드 안이 스크롤).
      // sm부터는 열 최소 6rem(가로 스크롤)·시간당 3.5rem·안쪽 세로 스크롤.
      className="isolate -mx-3 overflow-hidden rounded-none border-x-0 border-y bg-card shadow-xs [--day-min:0px] [--hour-h:max(1.75rem,calc((100dvh-23.375rem)*2/18))] [--time-col:2rem] max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col sm:mx-0 sm:rounded-xl sm:border-x sm:[--day-min:6rem] sm:[--hour-h:3.5rem] sm:[--time-col:4rem]"
    >
      {/* 스크롤 영역 자체에 이름을 둔다. 안에 포커스 가능한 링크·버튼이 항상 있어 tabIndex는 두지 않는다.
          scroll-padding: 가로는 고정 눈금 열, 세로는 sticky 영역(상한 기준 폴백, 실제 높이는 ScrollToSelected가 갱신) */}
      <ScrollToSelected
        selectedDate={selectedDate}
        weekStart={weekDays[0]}
        data-slot="week-scroll"
        role="group"
        aria-label={dict.gridLabel}
        className="max-h-none scroll-pt-[16.5rem] scroll-pl-[var(--time-col)] overflow-auto max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col sm:max-h-[max(24rem,calc(100dvh-7rem))] lg:max-h-[max(28rem,calc(100dvh-15rem))]"
      >
        <div className="min-w-[calc(var(--time-col)+7*var(--day-min))] max-sm:flex max-sm:flex-1 max-sm:flex-col">
          {/* 위에 붙는 영역: 헤더 + 6시 이전 */}
          <div data-slot="week-sticky" className="sticky top-0 z-40 bg-card">
            {/* 헤더 행 */}
            <div data-slot="week-header" className={cn(ROW, "border-b")}>
              <div data-slot="time-gutter" className={GUTTER} aria-hidden="true" />
              {weekDays.map((date) => {
                const isToday = date === today;
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
                    <WeekHeaderLink
                      lang={lang}
                      date={date}
                      isToday={isToday}
                      isSelected={date === selectedDate}
                      selectedDayLabel={dict.selectedDay}
                    />
                  </div>
                );
              })}
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
                              source={eventsById[event.id]}
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
            className={cn(ROW, "relative max-sm:flex-1")}
            // 높이는 최소값으로 둔다: sm 이상은 이 값이 곧 높이(시간당 3.5rem × 18), 휴대폰은 남은 높이를 flex로 채우되 이보다 작아지지 않는다.
            style={{ minHeight: `calc(var(--hour-h) * ${HOURS})` }}
          >
            <div data-slot="time-gutter" aria-hidden="true" className={GUTTER}>
              {Array.from({ length: HOURS }, (_, i) => (
                <span
                  key={i}
                  data-slot="hour-label"
                  className={cn(
                    "absolute right-1 leading-none whitespace-nowrap sm:right-2",
                    i > 0 ? "-translate-y-1/2" : "translate-y-1",
                    // 휴대폰은 눈금이 촘촘해서 2시간마다(6, 8, 10…)만 숫자를 보인다(눈금선은 1시간마다 그대로).
                    (START_HOUR + i) % 2 !== 0 && "max-sm:hidden",
                  )}
                  style={{ top: `${(i / HOURS) * 100}%` }}
                >
                  {/* 좁은 눈금 열(휴대폰)에서는 24시간제 숫자만, 2시간 단위 */}
                  <span className="sm:hidden">{(START_HOUR + i) % 24}</span>
                  <span className="hidden sm:inline">{formatHourLabel(START_HOUR + i, lang)}</span>
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
                eventsById={eventsById}
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
  eventsById,
  ariaLabel,
}: {
  day: DayTimeline;
  lang: Locale;
  isSelected: boolean;
  isToday: boolean;
  headerId: string;
  eventsById: Record<string, EditableEvent>;
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
      {/* 빈 곳을 누르면 그 시각으로 새 일정 폼을 연다(키보드는 툴바의 일정 추가 버튼) */}
      <SlotCreate date={day.date} startHour={START_HOUR} endHour={END_HOUR} />
      <DayOverlay date={day.date} />
      {blocks.length > 0 && (
        <ol className="m-0 list-none p-0">
          {blocks.map((block) => (
            <TimedBlock
              key={block.key}
              block={block}
              lang={lang}
              event={eventsById[block.id]}
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
  event,
  ariaLabel,
}: {
  block: TimeBlock;
  lang: Locale;
  event: EditableEvent;
  ariaLabel: LabelFn;
}) {
  const color = normalizeEventColor(block.color);
  const range = formatTimeRange(block.startAt, block.endAt, lang);
  const top = ((block.top - START_HOUR * 60) / RANGE_MINUTES) * 100;
  const height = ((block.bottom - block.top) / RANGE_MINUTES) * 100;
  const minutes = block.bottom - block.top;
  const twoLines = isTwoLine(minutes);
  const clipped = block.clippedTop || block.clippedBottom;
  const timeText = twoLines && !block.clippedTop ? range : formatTime(block.startAt, lang);
  return (
    <li
      data-slot="week-event"
      className="absolute z-10 px-px py-px transition-[top,height,left,width] duration-150 ease-out motion-reduce:transition-none sm:px-[3px]"
      style={{
        top: `${top}%`,
        height: `${height}%`,
        left: `${(block.column / block.columnCount) * 100}%`,
        width: `${100 / block.columnCount}%`,
      }}
    >
      <EventBlock
        variant="block"
        color={color}
        event={event}
        aria-label={ariaLabel(block.title, range, block.clippedTop, block.clippedBottom)}
        data-clipped-top={block.clippedTop || undefined}
        data-clipped-bottom={block.clippedBottom || undefined}
        className={cn(
          twoLines
            ? "flex flex-col justify-center py-0 leading-tight"
            : "flex items-center gap-1.5 py-0 leading-none",
          minutes < 30 && "text-[11px]",
          clipped ? "pr-3 pl-0.5 sm:pr-4 sm:pl-1.5" : "px-0.5 sm:px-1.5",
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
          className={cn(
            // 일정 이름은 항상 한 줄이고 넘치면 …으로 줄인다. 휴대폰은 시간 간격이 좁아 블록이 낮아서 60분 미만은 글자도 작게.
            "block min-w-0 truncate text-[10px] leading-snug font-semibold sm:text-xs",
            minutes < 60 && "max-sm:text-[9px] max-sm:leading-none",
            !twoLines && "flex-1",
          )}
        >
          {block.title}
        </span>
        {/* 낮은 블록은 시각을 제목 오른쪽에 두되, 겹쳐 폭이 좁으면 생략 */}
        {(twoLines || block.columnCount === 1) && (
          <span
            data-slot="event-time"
            className={cn(
              "hidden truncate leading-snug font-normal sm:block",
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

function EarlyChip({
  event: early,
  lang,
  source,
  ariaLabel,
}: {
  event: EarlyEvent;
  lang: Locale;
  source: EditableEvent;
  ariaLabel: LabelFn;
}) {
  const color = normalizeEventColor(early.color);
  const range = formatTimeRange(early.startAt, early.endAt, lang);
  return (
    <EventBlock
      variant="chip"
      color={color}
      event={source}
      aria-label={ariaLabel(early.title, range)}
    >
      <span
        data-slot="event-title"
        title={early.title}
        className="block w-full min-w-0 truncate text-[10px] leading-snug font-semibold sm:text-[11px]"
      >
        {early.title}
      </span>
      <span data-slot="event-time" className="hidden w-full truncate leading-snug font-normal sm:block">
        {formatTime(early.startAt, lang)}
      </span>
    </EventBlock>
  );
}
