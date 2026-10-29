"use client";

import { useMonthBarPreview, useMonthSelection } from "@/components/calendar/month-select";
import { splitIntoWeekSegments, type CalendarDate, type DateSpan } from "@/lib/calendar";
import { cn } from "@/lib/utils";

// 이 주와 겹치는 구간 조각(열 번호, 앞뒤 주로 이어지는지). 없으면 null.
function weekPart(span: DateSpan, days: CalendarDate[]) {
  return splitIntoWeekSegments(span, [days.map((date) => ({ date, inMonth: true }))])[0] ?? null;
}

// 한 주의 기간 선택 하이라이트. 선택 범위와 겹치는 열만 막대 하나로 그린다(주를 넘으면 이어짐 쪽 모서리를 편다).
// 일정 막대를 끄는 중(또는 저장 중)이면 그 막대를 새 날짜 자리에 겹쳐 그려, 막대가 칸에 맞춰 옮겨 가는 것처럼 보이게 한다.
// 장식 레이어라 포인터를 받지 않고(날짜 칸의 링크가 그대로 눌린다) 스크린 리더에도 숨긴다.
export function WeekSelection({ days }: { days: CalendarDate[] }) {
  const selection = useMonthSelection();
  const preview = useMonthBarPreview();
  const segment = selection ? weekPart(selection, days) : null;
  const bar = preview ? weekPart(preview.span, days) : null;
  if (!segment && !bar) return null;

  const corners = !segment
    ? ""
    : segment.continuesFromPrev && segment.continuesToNext
      ? "rounded-none"
      : segment.continuesFromPrev
        ? "rounded-l-none rounded-r-md"
        : segment.continuesToNext
          ? "rounded-l-md rounded-r-none"
          : "rounded-md";

  return (
    <>
      {segment && (
        <div
          aria-hidden="true"
          data-slot="week-selection"
          className="pointer-events-none absolute inset-0 grid grid-cols-7 grid-rows-1"
        >
          <div
            style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}` }}
            className={`m-px bg-primary/10 ring-1 ring-primary/40 ring-inset ${corners}`}
          />
        </div>
      )}
      {preview && bar && (
        // 일정 칩 레이어(week-overlay)와 같은 격자라 막대가 원래 막대와 같은 높이·줄에 놓인다. 칩(z-10) 위에 그린다.
        <div
          aria-hidden="true"
          data-slot="month-bar-preview"
          className="pointer-events-none absolute inset-x-0 top-9 z-20 grid grid-cols-7 grid-rows-[repeat(4,1.5rem)] gap-y-1 group-data-[expanded]/week:grid-rows-[repeat(var(--week-rows),1.5rem)]"
        >
          <div
            style={{ gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`, gridRow: preview.lane + 1 }}
            className={cn(
              "flex min-w-0 items-center border px-1 text-[11px] leading-none shadow-md sm:px-2 sm:text-xs",
              preview.colorClass,
              preview.hatch ? "event-hatch" : "",
              bar.continuesFromPrev ? "ml-0 rounded-l-none border-l-0" : "ml-0.5 rounded-l-md",
              bar.continuesToNext ? "mr-0 rounded-r-none border-r-0" : "mr-0.5 rounded-r-md",
            )}
          >
            <span className="min-w-0 flex-1 truncate leading-snug font-semibold">{preview.title}</span>
          </div>
        </div>
      )}
    </>
  );
}
