"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";

// 월간 그리드의 한 주. 일정이 3줄을 넘으면 "+N" 버튼으로 그 주만 모든 일정이 보일 만큼 펼친다.
// 달력은 서버에서 그리므로 펼침 상태만 이 작은 클라이언트 조각이 가지고, 펼침에 따른 모양 변화는 CSS(data-expanded, group-data)가 맡는다.
// (자식인 날짜 칸·일정 막대는 서버 컴포넌트 그대로라 펼쳐도 다시 그려지지 않는다.)
type ExpandContext = { expanded: boolean; toggle: () => void };

const WeekExpandContext = createContext<ExpandContext | null>(null);

export function ExpandableWeek({ rows, children }: { rows: number; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <WeekExpandContext.Provider value={{ expanded, toggle: () => setExpanded((open) => !open) }}>
      <div
        role="presentation"
        data-slot="week-row"
        data-expanded={expanded || undefined}
        // rows: 펼쳤을 때 일정 줄 수 + 접기 버튼 줄. 날짜 칸 높이와 막대 격자 높이가 이 값을 따른다.
        style={{ "--week-rows": rows } as CSSProperties}
        className="group/week relative last:[&_[data-slot=day-cell]]:border-b-0"
      >
        {children}
      </div>
    </WeekExpandContext.Provider>
  );
}

// 접힌 상태에서 그 날짜에 가려진 일정 수를 보여 주는 "+N" 버튼(누르면 이 주가 펼쳐진다). 펼친 뒤에는 보이지 않는다.
export function WeekMoreButton({ col, label, shortLabel }: { col: number; label: string; shortLabel: string }) {
  const ctx = useContext(WeekExpandContext);
  if (!ctx || ctx.expanded) return null;
  return (
    <button
      type="button"
      data-slot="more-button"
      aria-expanded={false}
      onClick={ctx.toggle}
      style={{ gridColumn: col + 1, gridRow: 4 }}
      className="pointer-events-auto relative z-10 mx-0.5 flex min-w-0 items-center truncate rounded px-1 text-left text-[11px] font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground sm:px-2 sm:text-xs focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span aria-hidden="true" className="sm:hidden">
        {shortLabel}
      </span>
      <span className="sr-only sm:not-sr-only sm:truncate">{label}</span>
    </button>
  );
}

// 펼친 상태의 마지막 줄에 나오는 "접기" 버튼.
export function WeekCollapseButton({ row, label }: { row: number; label: string }) {
  const ctx = useContext(WeekExpandContext);
  if (!ctx || !ctx.expanded) return null;
  return (
    <button
      type="button"
      data-slot="collapse-button"
      aria-expanded
      onClick={ctx.toggle}
      style={{ gridColumn: 1, gridRow: row }}
      className="pointer-events-auto relative z-10 mx-0.5 flex min-w-0 items-center gap-0.5 truncate rounded px-1 text-left text-[11px] font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground sm:px-2 sm:text-xs focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ChevronUp className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}
