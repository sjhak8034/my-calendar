import type { Ref } from "react";
import { BlockText } from "@/components/calendar/block-text";
import { COLOR_CLASS } from "@/components/calendar/event-colors";
import type { Floating } from "@/components/calendar/week-editor";
import { formatClockRange, normalizeEventColor } from "@/lib/calendar";
import { cn } from "@/lib/utils";

// 옮기는 동안 포인터를 자유롭게 따라다니는 블록(화면 고정 좌표).
// left0/top0/width는 잡은 순간의 위치로 고정하고, 포인터 이동량은 CSS 변수 --fx/--fy(transform)로만 전달한다
// (drag-session이 DOM에 직접 쓴다). 스냅된 시간이 바뀌어 다시 그려도 위치가 흔들리지 않는다.
export function FloatingBlock({
  floating,
  elRef,
}: {
  floating: Floating;
  elRef: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={elRef}
      aria-hidden="true"
      data-slot="drag-floating"
      className={cn(
        "pointer-events-none fixed z-[70] overflow-hidden rounded-md border px-1.5 py-0 text-xs will-change-transform motion-reduce:transition-none",
        COLOR_CLASS[normalizeEventColor(floating.color)],
        floating.settling
          ? // 내려앉으며 그림자와 링을 줄여, 곧 나타날 진짜 블록의 평평한 모양과 맞춘다.
            "shadow-none ring-0"
          : // 끄는 동안은 전환 없이 포인터를 그대로 따라간다.
            "shadow-2xl ring-2 ring-foreground/30",
      )}
      style={{
        left: floating.settling ? floating.settleLeft : floating.left0,
        top: floating.settling ? floating.settleTop : floating.top0,
        width: floating.settling ? floating.settleWidth : floating.width,
        height: floating.height,
        transform: "translate(var(--fx, 0px), var(--fy, 0px))",
      }}
    >
      <BlockText
        title={floating.title}
        time={formatClockRange(floating.startMin, floating.endMin)}
        minutes={floating.endMin - floating.startMin}
      />
    </div>
  );
}
