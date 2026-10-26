"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { DeleteDropZone } from "@/components/calendar/delete-drop-zone";
import { EditorToast } from "@/components/calendar/editor-toast";
import { EventSidePanel } from "@/components/calendar/event-side-panel";
import type { EventFormLabels } from "@/components/calendar/event-form";
import { FloatingBlock } from "@/components/calendar/floating-block";
import {
  SETTLE_DONE_MS,
  startDragSession,
  type DragMode,
  type DragTarget,
} from "@/components/calendar/drag-session";
import {
  useEventOverrides,
  type Override,
} from "@/components/calendar/use-event-overrides";
import { fromDayRange, type CalendarDate, type DayRange } from "@/lib/calendar";
import {
  defaultInput,
  fromEvent,
  type EditableEvent,
  type EventInput,
} from "@/lib/events/input";

export type { DragMode, DragTarget, Override };

const ERROR_MS = 6000; // 오류 알림이 사라지기까지의 시간

export type Panel = {
  mode: "create" | "edit";
  eventId: string | null;
  values: EventInput;
  session: number; // 열릴 때마다 바뀜: 폼을 새로 마운트해 초기 포커스를 준다
};

// 저장된 일정을 끄는 동안의 임시 위치(놓으면 낙관적 업데이트가 진짜 블록을 옮기므로 곧 걷는다)
export type Preview = {
  eventId: string;
  title: string;
  color: string | null;
  range: DayRange;
};

// 옮기는 동안 포인터를 따라다니는 떠 있는 블록. 놓으면(settling) 가장 가까운 열의 자리로 미끄러져 들어간다.
export type Floating = {
  left0: number; // 잡은 순간 블록의 화면 위치(고정)
  top0: number;
  width: number;
  height: number;
  settleLeft: number; // 놓았을 때 들어갈 열의 왼쪽
  settleTop: number; // 놓았을 때 들어갈 15분 칸의 위쪽
  settleWidth: number;
  date: CalendarDate; // 지금 놓으면 들어갈 날짜
  settling: boolean;
  title: string;
  color: string | null;
  startMin: number;
  endMin: number;
};

// 끌고 있는 동안의 정보: 크기 조절 중 블록은 base(시작 범위)로 고정해 두고 포인터 거리만 더한다.
export type DragInfo = { kind: "event" | "draft"; mode: DragMode; base: DayRange };

type WeekEditorContext = {
  labels: EventFormLabels;
  panel: Panel | null;
  preview: Preview | null;
  floating: Floating | null;
  dragging: boolean; // 포인터로 끌고 있는 중
  dragInfo: DragInfo | null;
  deleteHover: boolean; // 끄는 블록이 삭제 영역 위에 있음
  openCreate: (date: CalendarDate, minutes?: number) => void;
  openEdit: (event: EditableEvent) => void;
  close: () => void;
  closeSession: (session: number) => void; // 이 세션의 패널일 때만 닫는다
  updateValues: (patch: Partial<EventInput>) => void;
  beginDrag: (
    event: ReactPointerEvent,
    target: DragTarget,
    mode: DragMode,
    range: DayRange,
  ) => void;
  overrides: Record<string, Override>; // 일정 id → 아직 서버에 반영 중인 새 위치
  removed: Record<string, number>; // 일정 id → 삭제를 서버에 반영 중이라 목록에서 숨긴 일정
  reconcile: (serverEvents: readonly EditableEvent[]) => void; // 서버 데이터와 같아진 덮어쓰기를 걷는다
  consumeClick: () => boolean; // 방금 끌기로 끝난 클릭이면 true(클릭 처리를 건너뛴다)
};

const Context = createContext<WeekEditorContext | null>(null);

export function useWeekEditor(): WeekEditorContext {
  const value = useContext(Context);
  if (!value) throw new Error("useWeekEditor must be used inside WeekEditorProvider");
  return value;
}

type Props = {
  labels: EventFormLabels;
  initialCreateDate?: CalendarDate; // 월간 화면의 "일정 추가"로 들어오면 사이드바를 연 채 시작
  children: ReactNode;
};

// 주간 화면의 일정 편집 상태: 사이드바 폼, 그리드의 초안 블록, 드래그 이동·크기 조절, 낙관적 업데이트.
// 드래그 이벤트 처리는 drag-session, 낙관적 덮어쓰기는 use-event-overrides에 있다.
export function WeekEditorProvider({ labels, initialCreateDate, children }: Props) {
  const [panel, setPanel] = useState<Panel | null>(() =>
    initialCreateDate
      ? { mode: "create", eventId: null, values: defaultInput(initialCreateDate), session: 1 }
      : null,
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [floating, setFloating] = useState<Floating | null>(null);
  const [deleteHover, setDeleteHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionCounter = useRef(1);
  const returnFocus = useRef<HTMLElement | null>(null);
  const floatingEl = useRef<HTMLDivElement | null>(null);
  const stopDrag = useRef<(() => void) | null>(null); // 진행 중인 드래그를 끊는 함수
  const suppressClick = useRef(false);
  const timers = useRef<number[]>([]);
  const dropToken = useRef(0); // 놓을 때마다 증가: 이전 드롭의 정리 타이머가 새 드래그를 건드리지 않게 한다
  // 드래그 취소·세션 확인에서 읽는 최신 패널 상태
  const panelRef = useRef<Panel | null>(null);
  useEffect(() => {
    panelRef.current = panel;
  });

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  // 화면을 떠날 때: 진행 중인 드래그의 리스너·body 스타일과 대기 중인 타이머를 정리한다.
  useEffect(() => {
    const ids = timers.current;
    return () => {
      stopDrag.current?.();
      ids.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // ?new=1로 들어왔다면 주소에서 지운다(새로 고침마다 다시 열리지 않게).
  useEffect(() => {
    if (initialCreateDate) window.history.replaceState(null, "", window.location.pathname);
  }, [initialCreateDate]);

  // 오류 알림은 잠시 뒤 사라진다.
  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), ERROR_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  // 패널을 열기 전에 포커스가 있던 요소를 기억한다(이미 열려 있으면 처음 값을 유지한다).
  const remember = useCallback(() => {
    if (panelRef.current) return;
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement ? active : null;
  }, []);

  const openCreate = useCallback((date: CalendarDate, minutes?: number) => {
    remember();
    setError(null);
    setPanel({
      mode: "create",
      eventId: null,
      values: defaultInput(date, minutes),
      session: ++sessionCounter.current,
    });
  }, [remember]);

  const openEdit = useCallback((event: EditableEvent) => {
    remember();
    setError(null);
    setPanel({
      mode: "edit",
      eventId: event.id,
      values: fromEvent(event),
      session: ++sessionCounter.current,
    });
  }, [remember]);

  const close = useCallback(() => {
    setPanel(null);
    const target = returnFocus.current;
    returnFocus.current = null;
    // 연 블록이 삭제 등으로 사라졌다면 "일정 추가" 버튼으로 포커스를 돌려 키보드 위치를 잃지 않게 한다.
    (target?.isConnected
      ? target
      : document.querySelector<HTMLElement>('[data-slot="new-event-button"]')
    )?.focus();
  }, []);

  // 저장이 늦게 끝났을 때, 그 사이 다른 일정으로 열린 패널을 닫지 않도록 세션이 같을 때만 닫는다.
  const closeSession = useCallback(
    (session: number) => {
      if (panelRef.current?.session === session) close();
    },
    [close],
  );

  const updateValues = useCallback((patch: Partial<EventInput>) => {
    setPanel((prev) => (prev ? { ...prev, values: { ...prev.values, ...patch } } : prev));
  }, []);

  // 떠 있는 블록과 미리보기(끄는 동안의 임시 표시)를 걷는다.
  const clearTransient = useCallback(() => {
    setPreview(null);
    setFloating(null);
  }, []);

  const { overrides, removed, reconcile, commitEvent, removeEvent } = useEventOverrides({
    labels,
    onSubmit: useCallback(() => setError(null), []),
    // 이 일정을 사이드바에서 열어 둔 상태라면 시각 입력도 새 값으로 맞춘다.
    onSaved: useCallback((eventId: string, fields: Partial<EventInput>) => {
      setPanel((prev) =>
        prev && prev.eventId === eventId
          ? { ...prev, values: { ...prev.values, ...fields } }
          : prev,
      );
    }, []),
    onError: setError,
  });

  const consumeClick = useCallback(() => {
    const was = suppressClick.current;
    suppressClick.current = false;
    return was;
  }, []);

  const beginDrag = useCallback(
    (e: ReactPointerEvent, target: DragTarget, mode: DragMode, range: DayRange) => {
      if (e.button !== 0 || stopDrag.current) return;
      const original = target.kind === "draft" ? (panelRef.current?.values ?? null) : null;

      stopDrag.current = startDragSession({
        event: e,
        target,
        mode,
        range,
        getFloatingEl: () => floatingEl.current,
        callbacks: {
          onStart: () => setDragInfo({ kind: target.kind, mode, base: range }),
          // 15분 칸·날짜가 바뀔 때: 시간 표시·놓일 자리·사이드바 값을 갱신
          onChange: ({ range: next, geometry, block }) => {
            const title =
              target.kind === "event"
                ? target.event.title
                : panelRef.current?.values.title.trim() || labels.draftTitle;
            const color =
              target.kind === "event"
                ? target.event.color
                : (panelRef.current?.values.color ?? null);
            if (target.kind === "event") {
              setPreview({ eventId: target.event.id, title, color, range: next });
            } else {
              updateValues(fromDayRange(next));
            }
            if (mode !== "move") return;
            setFloating({
              left0: block.left,
              top0: block.top,
              width: block.width,
              ...geometry,
              date: next.date,
              settling: false,
              title,
              color,
              startMin: next.startMin,
              endMin: next.endMin,
            });
          },
          onDeleteHover: setDeleteHover,
          onDrop: (finalRange, overDelete) => {
            // 놓은 직후 같은 요소 위로 오는 click은 무시한다.
            suppressClick.current = true;
            later(() => {
              suppressClick.current = false;
            }, 0);
            if (overDelete) {
              // 삭제 영역에 놓음: 저장된 일정은 삭제(열려 있던 사이드바도 닫음), 초안은 버리고 사이드바를 닫는다.
              // 떠 있는 블록은 drag-session이 영역 중심으로 줄여 사라지게 한다.
              setPreview(null);
              // 놓일 열 강조가 안착 애니메이션 동안 다시 나타나지 않도록 날짜를 비운다.
              setFloating((prev) => (prev ? { ...prev, date: "" } : prev));
              if (target.kind === "event") {
                removeEvent(target.event);
                if (panelRef.current?.eventId === target.event.id) close();
              } else {
                close();
              }
            } else {
              // 떠 있던 블록은 놓을 열의 자리로 미끄러져 들어간다(서버 응답은 기다리지 않는다).
              setFloating((prev) => (prev ? { ...prev, settling: true } : prev));
              // 15분 칸이 그대로면(4px 넘게 끌었다가 제자리에 놓음) 저장하지 않는다.
              const unchanged =
                finalRange.date === range.date &&
                finalRange.startMin === range.startMin &&
                finalRange.endMin === range.endMin;
              if (target.kind === "event" && !unchanged) commitEvent(target.event, finalRange);
            }
            // 애니메이션이 끝나면 임시 표시를 걷는다. 그 사이 새 드래그가 시작·종료됐다면 그대로 둔다.
            const token = ++dropToken.current;
            later(() => {
              if (!stopDrag.current && dropToken.current === token) clearTransient();
            }, SETTLE_DONE_MS);
          },
          onCancel: (moved) => {
            // Esc로 취소해도 마우스를 놓을 때 click이 오므로, 놓을 때까지 click을 무시한다.
            if (moved) {
              suppressClick.current = true;
              window.addEventListener(
                "pointerup",
                () => later(() => (suppressClick.current = false), 0),
                { once: true, capture: true },
              );
            }
            setFloating(null);
            if (target.kind === "event") setPreview(null);
            else if (original) updateValues(original);
          },
          onFinish: () => {
            setDeleteHover(false);
            setDragInfo(null);
            stopDrag.current = null;
          },
        },
      });
    },
    [commitEvent, removeEvent, updateValues, close, labels, clearTransient, later],
  );

  // Esc로 사이드바 닫기(드래그 취소는 drag-session이 먼저 처리한다)
  useEffect(() => {
    if (!panel) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !stopDrag.current) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, close]);

  const dragging = dragInfo !== null;
  const value = useMemo<WeekEditorContext>(
    () => ({
      labels,
      panel,
      preview,
      floating,
      dragging,
      dragInfo,
      deleteHover,
      openCreate,
      openEdit,
      close,
      closeSession,
      updateValues,
      beginDrag,
      overrides,
      removed,
      reconcile,
      consumeClick,
    }),
    [
      labels,
      panel,
      preview,
      floating,
      dragging,
      dragInfo,
      deleteHover,
      openCreate,
      openEdit,
      close,
      closeSession,
      updateValues,
      beginDrag,
      overrides,
      removed,
      reconcile,
      consumeClick,
    ],
  );

  return (
    <Context.Provider value={value}>
      {/* 사이드바가 열리면 그리드가 가려지지 않게 오른쪽(큰 화면) 또는 아래(작은 화면)에 여백을 둔다. */}
      <div
        data-slot="week-editor"
        data-panel-open={panel ? "" : undefined}
        className="transition-[padding] duration-150 lg:data-panel-open:pr-[22.5rem] max-lg:data-panel-open:pb-[52dvh]"
      >
        {children}
      </div>
      <EventSidePanel />
      <DeleteDropZone
        visible={dragInfo?.mode === "move"}
        active={deleteHover}
        panelOpen={panel !== null}
      />
      {floating && (
        <FloatingBlock floating={floating} elRef={floatingEl} deleting={deleteHover} />
      )}
      {error && (
        <EditorToast
          message={error}
          dismissLabel={labels.dismiss}
          onDismiss={() => setError(null)}
        />
      )}
    </Context.Provider>
  );
}
