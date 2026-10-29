// 터치에서 일정을 "길게 눌러서" 끌기 위한 공통 처리(아이폰 캘린더와 같은 방식).
// 짧게 누르거나 문지르면 평소처럼 탭(수정)·스크롤이고, 손가락이 거의 움직이지 않은 채 LONG_PRESS_MS가 지나면 끌기가 시작된다.
// React 상태를 모르는 순수한 DOM 이벤트 처리이고, 끌기 자체는 호출하는 쪽(주간 drag-session, 월간 range-select-session)이 맡는다.

export const LONG_PRESS_MS = 400;
const MOVE_SLOP_PX = 10; // 기다리는 동안 이만큼 움직이면 스크롤로 보고 취소한다

export type LongPressPointer = {
  pointerId: number;
  clientX: number;
  clientY: number;
};

// 끌기가 시작된 뒤에는 화면 스크롤을 막아야 손가락을 움직여도 화면이 같이 밀리지 않는다.
// touchmove를 막으려면 "비수동(non-passive)" 리스너가 필요하고, iOS Safari는 터치가 시작된 뒤에 새로 단 리스너를 무시하는 경우가 있어
// 모듈이 불러와질 때 한 번만 달아 두고 깃발로만 켜고 끈다.
let blockScroll = false;
if (typeof document !== "undefined") {
  document.addEventListener(
    "touchmove",
    (ev) => {
      if (blockScroll && ev.cancelable) ev.preventDefault();
    },
    { passive: false },
  );
}

type Options = {
  // 길게 눌려 끌기를 시작할 때(손가락의 현재 위치)
  onActivate: (point: { x: number; y: number }) => void;
  // 활성화된 뒤 손가락을 떼거나 취소됐을 때(떠오른 표시 되돌리기용)
  onRelease?: () => void;
};

// 눌린 순간부터 길게 누름을 감시한다. 중간에 끊는 함수를 돌려준다(언마운트 등).
export function startLongPress(pointer: LongPressPointer, { onActivate, onRelease }: Options): () => void {
  let last = { x: pointer.clientX, y: pointer.clientY };
  let activated = false;
  let done = false;
  let timer = 0;

  // 길게 누르는 동안(기다림·끌기)의 길게 누르기 메뉴(Android의 컨텍스트 메뉴 등)를 막는다.
  const onContextMenu = (ev: Event) => ev.preventDefault();

  const cleanup = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd, true);
    window.removeEventListener("pointercancel", onEnd, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    if (activated) {
      blockScroll = false;
      onRelease?.();
    }
  };

  function onMove(ev: PointerEvent) {
    if (ev.pointerId !== pointer.pointerId) return;
    last = { x: ev.clientX, y: ev.clientY };
    // 기다리는 중에 움직이면 스크롤(또는 다른 동작)이므로 길게 누르기를 그만둔다.
    if (!activated && Math.hypot(last.x - pointer.clientX, last.y - pointer.clientY) > MOVE_SLOP_PX) cleanup();
  }

  function onEnd(ev: PointerEvent) {
    if (ev.pointerId !== pointer.pointerId) return;
    cleanup();
  }

  timer = window.setTimeout(() => {
    if (done) return;
    activated = true;
    blockScroll = true;
    // 진동은 Android에서만 된다(iOS Safari는 지원하지 않아 무시된다). 떠오르는 표시가 대신 알려 준다.
    navigator.vibrate?.(15);
    onActivate(last);
  }, LONG_PRESS_MS);

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd, true);
  window.addEventListener("pointercancel", onEnd, true);
  window.addEventListener("contextmenu", onContextMenu, true);

  return cleanup;
}
