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
import { COLOR_CLASS } from "@/components/calendar/event-colors";
import { startRangeSelect } from "@/components/calendar/range-select-session";
import { useWeekEditor } from "@/components/calendar/week-editor";
import {
  diffDays,
  eventDateSpan,
  normalizeEventColor,
  shiftSpan,
  validSpan,
  withEnd,
  withStart,
  type CalendarDate,
  type DateSpan,
} from "@/lib/calendar";
import { updateEvent } from "@/lib/events/actions";
import { fromEvent, type EditableEvent } from "@/lib/events/input";

// 월간 그리드에서 하이라이트할 날짜 범위(끌고 있는 범위, 저장 중인 새 구간, 없으면 열려 있는 새 일정 초안의 날짜).
const SelectionContext = createContext<DateSpan | null>(null);

export function useMonthSelection(): DateSpan | null {
  return useContext(SelectionContext);
}

// 끌고 있는(또는 저장 중인) 일정 막대의 생김새. 막대를 새 날짜 자리에 미리 그리는 데 쓴다.
type BarLook = {
  title: string;
  colorClass: string;
  hatch: boolean;
  lane: number; // 잡은 막대의 줄(0부터). 미리 보기 막대는 모든 주에서 이 줄에 그린다
};

// 새 날짜 자리에 그릴 막대 미리 보기. 막대는 서버가 배치한 요소라 직접 옮기지 않고, 각 주의 레이어(WeekSelection)가 이 구간에 막대를 겹쳐 그린다.
export type BarPreview = BarLook & { span: DateSpan };

const PreviewContext = createContext<BarPreview | null>(null);

export function useMonthBarPreview(): BarPreview | null {
  return useContext(PreviewContext);
}

// 일정 막대를 눌러 이만큼(px) 움직이면 바로 끌기로 본다. 그보다 작은 흔들림은 클릭(수정 입력창 열기)이다.
const DRAG_SLOP_PX = 5;

// 저장 중인 날짜 변경. events가 새로 도착하면(서버가 다시 그린 결과) 더는 이 구간을 미리 보여 주지 않는다.
type Saving = { eventId: string; span: DateSpan; bar: BarLook; events: readonly EditableEvent[] };

// 서버가 그린 월간 그리드를 감싸 마우스 끌기(기간 선택, 일정 막대 이동·늘이기)와 막대 클릭(수정)을 처리하고 상태를 나눠 준다.
// 그리드(children)는 서버 렌더 결과 그대로라 선택이 바뀌어도 다시 그려지지 않고, 각 주의 하이라이트 레이어(WeekSelection)만 갱신된다.
// 터치는 끌기를 지원하지 않는다(화면 스크롤과 겹침). 터치에서는 날짜 칸이 그대로 링크이고 툴바의 "일정 추가"·막대를 눌러 연 입력창의 날짜 칸을 쓴다.
export function MonthSelect({ events, children }: { events: readonly EditableEvent[]; children: ReactNode }) {
  const { panel, labels, selectRange, openEdit, updateValues, reportError } = useWeekEditor();
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragRange, setDragRange] = useState<DateSpan | null>(null);
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const [dragBar, setDragBar] = useState<BarLook | null>(null); // 지금 끄는 일정 막대(날짜 칸을 끌 때는 null)
  const [saving, setSaving] = useState<Saving | null>(null);
  const stop = useRef<(() => void) | null>(null); // 진행 중인 끌기를 끊는 함수
  const suppressClick = useRef(false); // 끌기 직후의 클릭(날짜 칸·막대 링크 이동, 수정 입력창 열기)을 막는 표시
  // 저장이 끝난 뒤에도 열려 있는 수정 입력창의 날짜를 맞추려고 최신 패널을 읽는다.
  const panelRef = useRef(panel);
  useEffect(() => {
    panelRef.current = panel;
  });

  // 화면을 떠날 때 진행 중인 끌기의 리스너와 body 스타일을 정리한다.
  useEffect(() => () => stop.current?.(), []);

  // 일정 id → 수정 폼 데이터(설명까지 포함해 월간 조회가 가져온 것)
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  // 새 일정 초안이 열려 있으면 폼의 시작·종료 날짜를 그대로 하이라이트한다(폼에서 날짜를 고치면 따라온다).
  const draftStart = panel?.mode === "create" ? panel.values.startDate : "";
  const draftEnd = panel?.mode === "create" ? panel.values.endDate : "";
  const draft = useMemo(() => validSpan(draftStart, draftEnd), [draftStart, draftEnd]);

  const activeSaving = saving && saving.events === events ? saving : null;

  // 끄는 동안에는 막대가 칸에 맞춰 새 날짜 자리로 옮겨 그려지고, 놓은 뒤에는 서버가 다시 그릴 때까지 그 자리에 머문다.
  const preview = useMemo<BarPreview | null>(() => {
    if (activeSaving) return { ...activeSaving.bar, span: activeSaving.span };
    if (dragBar && dragRange && dragEventId) return { ...dragBar, span: dragRange };
    return null;
  }, [activeSaving, dragBar, dragRange, dragEventId]);

  // 끌고 있거나 저장 중인 일정의 원래 막대를 흐리게 한다. 막대는 서버가 그린 요소라 속성만 직접 붙였다 뗀다
  // (서버가 새 데이터로 다시 그리면 요소가 바뀌어 속성도 함께 사라진다).
  const dimId = dragEventId ?? activeSaving?.eventId ?? null;
  useEffect(() => {
    if (!dimId) return;
    const chips = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>(
        `[data-slot="event-chip"][data-event-id="${CSS.escape(dimId)}"]`,
      ) ?? [],
    );
    chips.forEach((chip) => chip.setAttribute("data-dragging", ""));
    return () => chips.forEach((chip) => chip.removeAttribute("data-dragging"));
  }, [dimId]);

  // 끌어서 바꾼 날짜를 저장한다. 폼과 같은 updateEvent를 써서 서버가 입력을 다시 검증한다(시간·설명·색은 그대로).
  // 놓은 뒤 서버가 다시 그릴 때까지는 새 자리에 막대 미리 보기를 둔다. 실패하면 원래 자리에 두고 알린다.
  async function commitSpan(event: EditableEvent, span: DateSpan, bar: BarLook) {
    let original: DateSpan;
    try {
      original = eventDateSpan(event.start_at, event.end_at);
    } catch {
      return;
    }
    if (original.start === span.start && original.end === span.end) return; // 제자리: 저장할 것 없음
    setSaving({ eventId: event.id, span, bar, events });
    try {
      const result = await updateEvent(event.id, { ...fromEvent(event), startDate: span.start, endDate: span.end });
      if (!result.ok) {
        setSaving(null);
        reportError(result.code === "unauthorized" ? labels.errors.unauthorized : labels.moveFailed);
        return;
      }
      // 같은 일정의 수정 입력창이 열려 있으면 날짜를 새 값으로 맞춘다(안 그러면 저장 시 예전 날짜로 되돌아간다).
      const open = panelRef.current;
      if (open?.mode === "edit" && open.eventId === event.id) {
        updateValues({ startDate: span.start, endDate: span.end });
      }
    } catch {
      setSaving(null);
      reportError(labels.moveFailed);
    }
  }

  function startSession(
    e: ReactPointerEvent<HTMLDivElement>,
    params: {
      anchor?: CalendarDate;
      event?: EditableEvent;
      bar?: BarLook; // 일정 막대를 끌 때: 끄는 동안 이 모양의 막대를 새 날짜 자리에 그린다
      compute?: (origin: CalendarDate, current: CalendarDate) => DateSpan;
      slopPx?: number; // 이만큼 움직이면 바로 끌기(일정 막대)
    },
  ) {
    const { anchor, event, bar, compute, slopPx } = params;
    setDragBar(bar ?? null);
    stop.current = startRangeSelect({
      pointerId: e.pointerId,
      anchor,
      point: { x: e.clientX, y: e.clientY },
      root: e.currentTarget,
      slopPx,
      compute,
      callbacks: {
        onChange: (range) => {
          setDragRange(range);
          setDragEventId(range && event ? event.id : null);
        },
        onCommit: (range) => {
          if (event && bar) void commitSpan(event, range, bar);
          else selectRange(range.start, range.end);
        },
        onSuppressClick: () => {
          suppressClick.current = true;
        },
        onFinish: () => {
          stop.current = null;
          setDragBar(null);
          setDragRange(null);
          setDragEventId(null);
        },
      },
    });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (stop.current) return;
    // 마우스·펜의 왼쪽 버튼만.
    if (e.button !== 0 || !e.isPrimary || e.pointerType === "touch") return;
    const target = e.target as Element;

    // 일정 막대: 몸통을 끌면 통째로 옮기고, 종일 막대의 양 끝(data-handle)을 끌면 시작일·종료일을 바꾼다.
    // 끌지 않고 그냥 놓으면(5px 미만으로 움직이면) 클릭이라 수정 입력창이 열린다.
    const chip = target.closest<HTMLElement>('[data-slot="event-chip"]');
    if (chip) {
      const event = chip.dataset.eventId ? eventsById.get(chip.dataset.eventId) : undefined;
      if (!event) return;
      let span: DateSpan;
      try {
        span = eventDateSpan(event.start_at, event.end_at);
      } catch {
        return;
      }
      const handle = target.closest<HTMLElement>("[data-handle]")?.dataset.handle;
      startSession(e, {
        event,
        slopPx: DRAG_SLOP_PX,
        bar: {
          title: event.title,
          colorClass: COLOR_CLASS[normalizeEventColor(event.color)],
          hatch: event.all_day || span.start !== span.end,
          lane: Number(chip.dataset.lane) || 0,
        },
        compute:
          handle === "start"
            ? (_origin, current) => withStart(span, current)
            : handle === "end"
              ? (_origin, current) => withEnd(span, current)
              : (origin, current) => shiftSpan(span, diffDays(origin, current)),
      });
      return;
    }

    // 날짜 칸: 끌어서 기간을 골라 새 일정 입력창을 연다.
    const cell = target.closest<HTMLElement>('[data-slot="day-cell"]');
    const date = cell?.dataset.date;
    if (!cell || !date) return;
    startSession(e, { anchor: date });
  }

  function onClickCapture(e: ReactMouseEvent<HTMLDivElement>) {
    // 끌어서 놓은 직후에 생기는 클릭이 날짜 칸·막대 링크를 열지 않게 한다. 키보드로 누른 클릭(detail 0)은 막지 않는다.
    if (suppressClick.current && e.detail > 0) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // 일정 막대를 그냥 누르면 주간 화면으로 가지 않고 이 화면에서 수정 입력창을 연다.
    // 새 탭으로 열기(Ctrl·⌘·Shift·Alt, 가운데 버튼)는 링크 그대로 두고, 일정 데이터를 못 찾으면 기존처럼 주간 화면으로 이동한다.
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const chip = (e.target as Element).closest<HTMLElement>('[data-slot="event-chip"]');
    const event = chip?.dataset.eventId ? eventsById.get(chip.dataset.eventId) : undefined;
    if (!event) return;
    e.preventDefault();
    e.stopPropagation();
    openEdit(event);
  }

  return (
    <SelectionContext.Provider value={activeSaving?.span ?? dragRange ?? draft}>
      <PreviewContext.Provider value={preview}>
        <div
          ref={rootRef}
          data-slot="month-select"
          className="select-none"
          onPointerDown={onPointerDown}
          onClickCapture={onClickCapture}
          // 링크를 누른 채 끌면 브라우저가 링크 끌기를 시작해 pointercancel로 끌기가 끊기므로 막는다.
          onDragStart={(e) => e.preventDefault()}
        >
          {children}
        </div>
      </PreviewContext.Provider>
    </SelectionContext.Provider>
  );
}
