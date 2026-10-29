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
      <span
        className={cn(
          // 일정 이름은 항상 한 줄이고 넘치면 …으로 줄인다(week-grid의 TimedBlock과 같은 규칙).
          "block min-w-0 truncate text-[10px] leading-snug font-semibold sm:text-xs",
          minutes < 60 && "max-sm:text-[9px] max-sm:leading-none",
          !twoLines && "flex-1",
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "hidden truncate text-[11px] leading-snug font-normal tabular-nums sm:block",
          twoLines ? "mt-0.5" : "shrink-0",
        )}
      >
        {time}
      </span>
    </span>
  );
}
