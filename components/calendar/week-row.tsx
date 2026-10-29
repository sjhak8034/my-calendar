import { fillTemplate, type GridDay, type CalendarDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { WeekData } from "@/lib/events/month-layout";
import { DayCell } from "./day-cell";
import { EventChip } from "./event-chip";
import { ExpandableWeek, WeekCollapseButton, WeekMoreButton } from "./expandable-week";
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
// 일정이 3줄을 넘으면 "+N" 버튼이 나오고, 누르면 이 주만 모든 일정이 보일 만큼 펼쳐진다(ExpandableWeek: 일정 줄 수 + 접기 줄).
export function WeekRow({ lang, days, today, data, dict }: Props) {
  const { layout, eventCounts } = data;
  // 가려진 일정까지 포함한 전체 줄 수. 펼치면 이만큼 + 접기 버튼 줄이 필요하다.
  const totalLanes = layout.placed.reduce((max, segment) => Math.max(max, segment.lane + 1), 0);
  const hasHidden = layout.hiddenByDay.some((count) => count > 0);

  return (
    // 래퍼는 의미 없는 컨테이너. 실제 row는 날짜 칸만 감싼다.
    <ExpandableWeek rows={totalLanes + 1}>
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
        className="pointer-events-none absolute inset-x-0 top-9 grid grid-cols-7 grid-rows-[repeat(4,1.5rem)] gap-y-1 group-data-[expanded]/week:grid-rows-[repeat(var(--week-rows),1.5rem)]"
      >
        {/* 3줄을 넘는 일정(visible=false)은 접힌 동안 숨겨 두고, 펼치면 보인다. */}
        {layout.placed.map((segment) => (
          <EventChip
            key={`${segment.id}-${segment.startCol}`}
            lang={lang}
            segment={segment}
            allDayLabel={dict.allDay}
            collapsed={!segment.visible}
          />
        ))}
        {layout.hiddenByDay.map((count, col) =>
          count > 0 ? (
            <WeekMoreButton
              key={col}
              col={col}
              label={fillTemplate(dict.moreEvents, { count })}
              shortLabel={`+${count}`}
            />
          ) : null,
        )}
        {hasHidden && <WeekCollapseButton row={totalLanes + 1} label={dict.collapse} />}
      </div>
    </ExpandableWeek>
  );
}
