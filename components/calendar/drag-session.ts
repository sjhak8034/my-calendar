import type { PointerEvent as ReactPointerEvent } from "react";
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  minuteFromY,
  positionAt,
  resizeOffsetPx,
  settleGeometry,
  type ColumnRect,
  type DayRange,
} from "@/lib/calendar";
import type { EditableEvent } from "@/lib/events/input";

// 주간 시간표의 포인터 드래그 한 번(이동 또는 위·아래 가장자리 크기 조절).
// React 상태를 모르는 순수한 DOM 이벤트 처리이고, 상태 변경은 콜백으로 provider에 맡긴다.
// 포인터 이벤트는 window에 걸어, 끄는 동안 블록이 다시 그려져도 끊기지 않게 한다.

export type DragMode = "move" | "start" | "end";
export type DragTarget = { kind: "draft" } | { kind: "event"; event: EditableEvent };

const CLICK_SLOP = 4; // 이 거리(px) 안의 이동은 클릭으로 본다
const EDGE_ZONE = 40; // 스크롤 영역 가장자리 자동 스크롤 구간(px)
const MAX_SCROLL_SPEED = 18; // 프레임당 px
export const SETTLE_MS = 160; // 놓은 블록이 열 자리로 들어가는 시간
export const SETTLE_DONE_MS = SETTLE_MS + 40; // 안착이 끝나 임시 표시를 걷어도 되는 시점

export type Geometry = ReturnType<typeof settleGeometry>;

// 15분 칸·날짜가 바뀔 때마다 provider에 주는 정보
export type DragView = {
  range: DayRange;
  geometry: Geometry; // 지금 놓으면 안착할 화면 좌표
  block: { left: number; top: number; width: number }; // 잡은 순간 블록의 화면 위치(px)
};

export type DragCallbacks = {
  onStart: () => void; // 클릭 한계를 넘어 실제 드래그가 시작됨
  onChange: (view: DragView) => void;
  onDrop: (range: DayRange) => void; // 이동이 있었던 드래그를 놓음
  onCancel: (moved: boolean) => void; // Esc 또는 pointercancel
  onFinish: () => void; // 어느 경우든 리스너 해제 직후
};

export type StartDragParams = {
  event: ReactPointerEvent;
  target: DragTarget;
  mode: DragMode;
  range: DayRange; // 드래그를 시작할 때의 구간
  getFloatingEl: () => HTMLElement | null;
  callbacks: DragCallbacks;
};

type Session = {
  lastX: number;
  lastY: number;
  moved: boolean;
  last: DayRange;
  raf: number;
  dirty: boolean; // 마지막 프레임 이후 포인터가 움직였거나 스크롤됨
  applied: boolean; // 한 번이라도 provider에 반영했는지
};

// 화면 y → 그 날 00:00부터의 분(스냅 없음)
function rawMinute(y: number, columns: ColumnRect[]): number {
  return minuteFromY(y, columns[0], GRID_START_HOUR, GRID_END_HOUR);
}

function measureColumns(): ColumnRect[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="week-day"]')).map(
    (el) => {
      const r = el.getBoundingClientRect();
      return { date: el.dataset.date ?? "", left: r.left, top: r.top, width: r.width, height: r.height };
    },
  );
}

// 드래그를 시작하고, 정리 함수를 돌려준다(언마운트 등 중간에 끊을 때 호출). 시작할 수 없으면 null.
export function startDragSession(params: StartDragParams): (() => void) | null {
  const { event: e, target, mode, range, getFloatingEl, callbacks } = params;

  // 열 위치는 드래그 중 거의 변하지 않으므로 캐시하고, 스크롤·크기 변경 때만 다시 잰다.
  let cache: ColumnRect[] | null = null;
  const measure = () => (cache ??= measureColumns());

  const first = measure();
  if (first.length === 0) return null;

  // 옮기기에서는 잡은 블록의 화면 위치·폭과, 블록 안에서 잡은 위치를 기억한다.
  const grabRect =
    mode === "move" && e.currentTarget instanceof HTMLElement
      ? e.currentTarget.getBoundingClientRect()
      : null;
  const block = {
    left: grabRect?.left ?? 0,
    top: grabRect?.top ?? 0,
    width: grabRect?.width ?? 0,
  };
  const pointerId = e.pointerId;
  const startX = e.clientX;
  const startY = e.clientY;
  // 잡은 지점이 구간 시작에서 떨어진 분(스냅 없는 값으로 계산해 잡은 자리가 튀지 않게 한다)
  const grab = rawMinute(startY, first) - range.startMin;
  const input = { mode, range, grab };

  const s: Session = {
    lastX: startX,
    lastY: startY,
    moved: false,
    last: range,
    raf: 0,
    dirty: false,
    applied: false,
  };

  // 15분 칸·날짜가 바뀔 때만 provider에 알린다.
  const apply = (next: DayRange, columns: ColumnRect[]) => {
    const changed =
      !s.applied ||
      next.date !== s.last.date ||
      next.startMin !== s.last.startMin ||
      next.endMin !== s.last.endMin;
    s.applied = true;
    s.last = next;
    if (changed) {
      callbacks.onChange({ range: next, geometry: settleGeometry(next, columns), block });
    }
  };

  // 화면에 보이는 위치는 포인터를 픽셀 단위로 따라간다(React 상태를 거치지 않고 DOM에 직접).
  // 이동: 떠 있는 블록의 transform 변수, 크기 조절: 늘어나는 가장자리의 --dy.
  const follow = (columns: ColumnRect[]) => {
    if (mode === "move") {
      const el = getFloatingEl();
      if (!el) return;
      el.style.setProperty("--fx", `${s.lastX - startX}px`);
      el.style.setProperty("--fy", `${s.lastY - startY}px`);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-drag-surface="${target.kind}"]`);
    if (!el) return;
    el.style.setProperty("--dy", `${resizeOffsetPx(mode, range, s.lastY, columns)}px`);
  };

  // 프레임당 한 번: 가장자리 자동 스크롤 + (포인터가 움직였거나 스크롤됐다면) 위치 계산·적용
  const frame = () => {
    if (!s.moved) return;
    let scrolled = false;
    const box = document.querySelector<HTMLElement>('[data-slot="week-scroll"]');
    if (box) {
      const rect = box.getBoundingClientRect();
      const sticky = box.querySelector<HTMLElement>('[data-slot="week-sticky"]')?.offsetHeight ?? 0;
      const top = rect.top + sticky;
      let speed = 0;
      if (s.lastY < top + EDGE_ZONE) {
        speed = -Math.min(1, (top + EDGE_ZONE - s.lastY) / EDGE_ZONE);
      } else if (s.lastY > rect.bottom - EDGE_ZONE) {
        speed = Math.min(1, (s.lastY - (rect.bottom - EDGE_ZONE)) / EDGE_ZONE);
      }
      if (speed !== 0) {
        box.scrollTop += speed * MAX_SCROLL_SPEED;
        cache = null;
        scrolled = true;
      }
    }
    if (s.dirty || scrolled) {
      s.dirty = false;
      const columns = measure();
      const next = positionAt(input, s.lastX, s.lastY, columns);
      if (next) apply(next, columns);
    }
    // 스냅과 무관하게 매 프레임 포인터에 붙인다(요소가 방금 그려졌을 수도 있어 계속 시도).
    follow(measure());
    s.raf = requestAnimationFrame(frame);
  };

  const invalidate = () => {
    cache = null;
    s.dirty = true;
  };

  const timers: number[] = [];
  let finished = false;

  const stop = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(s.raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("blur", onCancel);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", invalidate, true);
    window.removeEventListener("resize", invalidate);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    callbacks.onFinish();
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return; // 다른 손가락·포인터는 무시
    // 창을 벗어난 사이에 버튼을 놓아 pointerup을 못 받은 경우: 놓은 것으로 처리한다.
    if (ev.pointerType === "mouse" && ev.buttons === 0) {
      onUp(ev);
      return;
    }
    s.lastX = ev.clientX;
    s.lastY = ev.clientY;
    if (!s.moved) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < CLICK_SLOP) return;
      s.moved = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor = mode === "move" ? "grabbing" : "ns-resize";
      // 이전 드래그에서 남은 변수를 지운다.
      document
        .querySelector<HTMLElement>(`[data-drag-surface="${target.kind}"]`)
        ?.style.removeProperty("--dy");
      callbacks.onStart();
      s.raf = requestAnimationFrame(frame);
    }
    s.dirty = true; // 계산은 다음 프레임에 한 번만
  };

  // 놓는 순간: 보이는 위치를 그대로 두고 좌표계를 안착 자리로 옮긴 뒤, 남은 거리를 부드럽게 0으로 만든다.
  const settleFloating = (r: DayRange, columns: ColumnRect[]) => {
    const el = getFloatingEl();
    if (!el) return;
    const g = settleGeometry(r, columns);
    const left = block.left + (s.lastX - startX);
    const top = block.top + (s.lastY - startY);
    el.style.transition = "none";
    el.style.left = `${g.settleLeft}px`;
    el.style.top = `${g.settleTop}px`;
    el.style.height = `${g.height}px`;
    el.style.setProperty("--fx", `${left - g.settleLeft}px`);
    el.style.setProperty("--fy", `${top - g.settleTop}px`);
    void el.offsetWidth; // 위 변경을 먼저 확정한 뒤 전환을 시작한다.
    const t = `${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    el.style.transition = `transform ${t}, width ${t}, box-shadow ${t}`;
    el.style.width = `${g.settleWidth}px`;
    el.style.setProperty("--fx", "0px");
    el.style.setProperty("--fy", "0px");
    timers.push(
      window.setTimeout(() => {
        if (getFloatingEl() === el) el.style.transition = "";
      }, SETTLE_DONE_MS),
    );
  };

  const onUp = (ev?: PointerEvent) => {
    if (ev && ev.pointerId !== pointerId) return;
    const moved = s.moved;
    const columns = measure();
    // 마지막 위치를 놓치지 않도록 대기 중인 이동을 한 번 반영한다.
    if (moved && s.dirty) {
      const next = positionAt(input, s.lastX, s.lastY, columns);
      if (next) apply(next, columns);
    }
    const finalRange = s.last;
    stop();
    if (!moved) return; // 클릭: 뒤따르는 click 이벤트가 사이드바를 연다.
    if (mode === "move") settleFloating(finalRange, columns);
    callbacks.onDrop(finalRange);
  };

  const onCancel = (ev?: Event) => {
    if (ev instanceof PointerEvent && ev.pointerId !== pointerId) return;
    const moved = s.moved;
    stop();
    callbacks.onCancel(moved);
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.stopPropagation();
    onCancel();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("blur", onCancel);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", invalidate, true);
  window.addEventListener("resize", invalidate);

  // 중간에 끊을 때(언마운트 등): 리스너·rAF·안착 타이머를 모두 정리한다.
  return () => {
    stop();
    for (const id of timers) window.clearTimeout(id);
  };
}
