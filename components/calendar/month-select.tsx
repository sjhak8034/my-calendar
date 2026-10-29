"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { startRangeSelect } from "@/components/calendar/range-select-session";
import { useWeekEditor } from "@/components/calendar/week-editor";
import { validSpan, type DateSpan } from "@/lib/calendar";

// 월간 그리드에서 하이라이트할 날짜 범위(끌고 있는 범위, 없으면 열려 있는 새 일정 초안의 날짜).
const SelectionContext = createContext<DateSpan | null>(null);

export function useMonthSelection(): DateSpan | null {
  return useContext(SelectionContext);
}

// 서버가 그린 월간 그리드를 감싸 기간 선택(마우스로 날짜 칸을 끌기)을 처리하고 상태를 나눠 준다.
// 그리드(children)는 서버 렌더 결과 그대로라 선택이 바뀌어도 다시 그려지지 않고, 각 주의 하이라이트 레이어(WeekSelection)만 갱신된다.
// 터치는 끌기를 지원하지 않는다(화면 스크롤과 겹침). 터치에서는 날짜 칸이 그대로 링크이고 툴바의 "일정 추가"로 입력창을 연다.
export function MonthSelect({ children }: { children: ReactNode }) {
  const { panel, openCreateRange } = useWeekEditor();
  const [dragRange, setDragRange] = useState<DateSpan | null>(null);
  const stop = useRef<(() => void) | null>(null); // 진행 중인 끌기를 끊는 함수
  const suppressClick = useRef(false); // 끌기 직후의 클릭(날짜 칸 링크 이동)을 막는 표시

  // 화면을 떠날 때 진행 중인 끌기의 리스너와 body 스타일을 정리한다.
  useEffect(() => () => stop.current?.(), []);

  // 새 일정 초안이 열려 있으면 폼의 시작·종료 날짜를 그대로 하이라이트한다(폼에서 날짜를 고치면 따라온다).
  const draftStart = panel?.mode === "create" ? panel.values.startDate : "";
  const draftEnd = panel?.mode === "create" ? panel.values.endDate : "";
  const draft = useMemo(() => validSpan(draftStart, draftEnd), [draftStart, draftEnd]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (stop.current) return;
    // 마우스·펜의 왼쪽 버튼만. 일정 칩과 "더 보기" 링크는 날짜 칸의 자손이 아니라(오버레이 소속) 여기서 걸러진다.
    if (e.button !== 0 || !e.isPrimary || e.pointerType === "touch") return;
    const cell = (e.target as Element).closest<HTMLElement>('[data-slot="day-cell"]');
    const date = cell?.dataset.date;
    if (!cell || !date) return;
    stop.current = startRangeSelect({
      pointerId: e.pointerId,
      anchor: date,
      root: e.currentTarget,
      callbacks: {
        onChange: setDragRange,
        onCommit: (range) => openCreateRange(range.start, range.end),
        onSuppressClick: () => {
          suppressClick.current = true;
        },
        onFinish: () => {
          stop.current = null;
          setDragRange(null);
        },
      },
    });
  }

  // 끌어서 놓은 직후에 생기는 클릭이 날짜 칸 링크를 열지 않게 한다. 키보드로 누른 클릭(detail 0)은 막지 않는다.
  function onClickCapture(e: ReactMouseEvent<HTMLDivElement>) {
    if (suppressClick.current && e.detail > 0) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <SelectionContext.Provider value={dragRange ?? draft}>
      <div
        data-slot="month-select"
        className="select-none"
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
        // 링크를 누른 채 끌면 브라우저가 링크 끌기를 시작해 pointercancel로 끌기가 끊기므로 막는다.
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>
    </SelectionContext.Provider>
  );
}
