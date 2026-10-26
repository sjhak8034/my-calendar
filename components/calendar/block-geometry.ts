import type { CSSProperties } from "react";
import { MIN_BLOCK_MINUTES } from "@/lib/calendar";

export { MIN_BLOCK_MINUTES };

// [startMin, endMin](그 날 00:00부터의 분)을 날짜 열 안의 top/height(%)로 바꾼다.
// rangeStart~rangeEnd는 열이 보여 주는 분 범위(06:00~24:00).
export function blockPercent(
  startMin: number,
  endMin: number,
  rangeStart: number,
  rangeEnd: number,
): { top: number; height: number } {
  const total = rangeEnd - rangeStart;
  const from = Math.min(Math.max(startMin, rangeStart), rangeEnd);
  const to = Math.min(Math.max(endMin, from + MIN_BLOCK_MINUTES), rangeEnd);
  return {
    top: ((from - rangeStart) / total) * 100,
    height: ((to - from) / total) * 100,
  };
}

export function blockStyle(
  startMin: number,
  endMin: number,
  rangeStart: number,
  rangeEnd: number,
): CSSProperties {
  const { top, height } = blockPercent(startMin, endMin, rangeStart, rangeEnd);
  return { top: `${top}%`, height: `${height}%` };
}

// 크기 조절 중 스타일: 드래그를 시작할 때의 범위(base)를 고정해 두고,
// 포인터가 움직인 거리(--dy, px)만 CSS 변수로 더하거나 뺀다. 변수는 프레임 루프가 DOM에 직접 쓰므로
// 스냅된 시간이 바뀌어 React가 다시 그려도 위치가 흔들리지 않는다.
export function resizingStyle(
  mode: "start" | "end",
  base: { startMin: number; endMin: number },
  rangeStart: number,
  rangeEnd: number,
): CSSProperties {
  const { top, height } = blockPercent(base.startMin, base.endMin, rangeStart, rangeEnd);
  return mode === "end"
    ? { top: `${top}%`, height: `calc(${height}% + var(--dy, 0px))` }
    : {
        top: `calc(${top}% + var(--dy, 0px))`,
        height: `calc(${height}% - var(--dy, 0px))`,
      };
}
