import { normalizeRange, type CalendarDate, type DateSpan } from "@/lib/calendar";

// 월간 그리드에서 날짜 칸을 눌러 다른 칸까지 끄는 기간 선택 한 번.
// React 상태를 모르는 순수한 DOM 이벤트 처리이고(drag-session과 같은 방식), 상태 변경은 콜백으로 맡긴다.
// 포인터 이벤트는 window에 걸어, 끄는 동안 하이라이트가 다시 그려져도 끊기지 않게 한다.

export type RangeSelectCallbacks = {
  onChange: (range: DateSpan | null) => void; // 하이라이트할 범위(null이면 지운다)
  onCommit: (range: DateSpan) => void; // 끌어서 고른 기간을 놓음
  onSuppressClick: () => void; // 이 선택 직후에 올 클릭(날짜 칸 링크 이동)을 막아야 함
  onFinish: () => void; // 어느 경우든 리스너 해제 직후
};

export type StartRangeSelectParams = {
  pointerId: number;
  anchor: CalendarDate; // 누른 칸의 날짜
  root: HTMLElement; // 날짜 칸([data-slot="day-cell"][data-date])을 품은 요소
  callbacks: RangeSelectCallbacks;
};

type Cell = { date: CalendarDate; left: number; right: number; top: number; bottom: number };

// 끌기를 시작해 리스너를 걸고, 중단하는 함수를 돌려준다(화면을 떠날 때 부른다).
export function startRangeSelect({ pointerId, anchor, root, callbacks }: StartRangeSelectParams): () => void {
  let current = anchor;
  // 다른 날짜 칸에 한 번이라도 들어가야 "끌기"로 본다. 한 칸 안의 흔들림은 그대로 클릭(날짜 상세 이동)으로 남는다.
  let active = false;
  let cells: Cell[] | null = null;
  let finished = false;

  // 칸 위치는 끌기 시작 후 처음 필요할 때 측정해 두고, 스크롤·크기 변경 때 버린다.
  const measure = (): Cell[] =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-slot="day-cell"][data-date]')).map((el) => {
      const rect = el.getBoundingClientRect();
      return { date: el.dataset.date as CalendarDate, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
  const invalidate = () => {
    cells = null;
  };

  // 포인터 아래의 날짜. 그리드 밖이면 null이라 마지막 날짜가 유지된다.
  const dateAt = (x: number, y: number): CalendarDate | null => {
    cells ??= measure();
    const hit = cells.find((c) => x >= c.left && x < c.right && y >= c.top && y < c.bottom);
    return hit ? hit.date : null;
  };

  const setActive = () => {
    active = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "crosshair";
  };

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", invalidate, true);
    window.removeEventListener("resize", invalidate);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    callbacks.onFinish();
  };

  const range = () => normalizeRange(anchor, current);

  function onMove(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    // 버튼 뗌을 놓친 경우(창 밖에서 놓음 등)에는 놓은 것으로 처리한다.
    if (ev.pointerType === "mouse" && ev.buttons === 0) {
      onUp(ev);
      return;
    }
    const date = dateAt(ev.clientX, ev.clientY);
    if (!date || date === current) return;
    current = date;
    if (!active) setActive();
    callbacks.onChange(range());
  }

  function onUp(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    if (active) {
      const picked = range();
      callbacks.onSuppressClick();
      finish();
      callbacks.onCommit(picked);
      return;
    }
    finish();
  }

  // pointercancel·창 포커스 이탈: 선택을 취소한다(클릭은 만들어지지 않는다).
  function onCancel() {
    if (active) callbacks.onChange(null);
    finish();
  }

  // 창이 포커스를 잃음(Alt-Tab, 알림 등): 선택은 취소하지만 포인터는 아직 눌려 있어서,
  // 돌아와 놓을 때 생기는 클릭이 날짜 칸 링크를 열지 않게 한다(끌기 중이었을 때만).
  function onBlur() {
    if (active) callbacks.onSuppressClick();
    onCancel();
  }

  // Esc: 끄는 중이면 선택을 취소한다. 캡처 단계에서 받아 사이드바 닫기(Esc)가 같이 일어나지 않게 막는다.
  function onKey(ev: KeyboardEvent) {
    if (ev.key !== "Escape") return;
    if (active) {
      ev.stopPropagation();
      ev.preventDefault();
      callbacks.onChange(null);
      // 포인터는 아직 눌려 있어서, 놓을 때 생기는 클릭이 날짜 칸 링크를 열지 않게 한다.
      callbacks.onSuppressClick();
    }
    finish();
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("blur", onBlur);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", invalidate, true);
  window.addEventListener("resize", invalidate);

  return () => {
    if (active) callbacks.onChange(null);
    finish();
  };
}
