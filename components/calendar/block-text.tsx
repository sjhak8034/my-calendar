import { MIN_BLOCK_MINUTES } from "@/components/calendar/block-geometry";
import { cn } from "@/lib/utils";

// 시간 블록 안의 글자 배치. 실제 블록과 끌 때 보이는 블록(떠 있는 블록·미리보기·초안)이 같은 규칙을 쓴다.
// 45분 이상: 제목 + 시각 두 줄을 세로 가운데에, 그보다 짧으면 한 줄(제목 왼쪽, 시각 오른쪽)을 가운데에 둔다.
const TWO_LINE_MINUTES = 45;

export function isTwoLine(minutes: number): boolean {
  return Math.max(minutes, MIN_BLOCK_MINUTES) >= TWO_LINE_MINUTES;
}

export function BlockText({
  title,
  time,
  minutes,
}: {
  title: string;
  time: string;
  minutes: number;
}) {
  const twoLines = isTwoLine(minutes);
  return (
    <span
      className={cn(
        "flex size-full min-w-0",
        twoLines ? "flex-col justify-center leading-tight" : "items-center gap-1.5 leading-none",
      )}
    >
      <span className={cn("block min-w-0 truncate font-semibold", !twoLines && "flex-1")}>
        {title}
      </span>
      <span
        className={cn(
          "block truncate text-[11px] font-normal tabular-nums",
          twoLines ? "mt-0.5" : "shrink-0",
        )}
      >
        {time}
      </span>
    </span>
  );
}
