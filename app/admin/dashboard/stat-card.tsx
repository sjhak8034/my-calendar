import { cn } from "@/lib/utils";

type Point = { label: string; value: number };

const W = 300;
const H = 84;
const PAD_X = 8;
const PAD_Y = 10;

// 점들을 부드러운 곡선으로 잇는 경로. 구간마다 가로 방향 제어점을 써서 값을 넘어서 출렁이지 않는다.
function smoothPath(xs: number[], ys: number[]) {
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const mid = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${mid} ${ys[i - 1]}, ${mid} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  return d;
}

// 일별 추이 선 그래프(라이브러리 없이 SVG). 점에 마우스를 올리면 날짜와 값이 툴팁으로 보인다.
function LineChart({ points, ariaLabel }: { points: Point[]; ariaLabel: string }) {
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));
  const xs = points.map((_, i) => (n === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (n - 1)));
  const ys = points.map((p) => H - PAD_Y - (p.value / max) * (H - 2 * PAD_Y));
  // 점이 너무 많으면(30일) 마지막 점만 강조해 선이 점에 묻히지 않게 한다.
  const showAllDots = n <= 16;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block h-auto w-full overflow-visible">
        <path d={smoothPath(xs, ys)} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) =>
          showAllDots || i === n - 1 ? (
            <circle key={p.label} cx={xs[i]} cy={ys[i]} r={1.5} fill="var(--card)" stroke="var(--primary)" strokeWidth={1}>
              <title>{`${p.label}: ${p.value.toLocaleString("ko-KR")}`}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span>{points[n - 1]?.label}</span>
      </div>
    </div>
  );
}

// 이전 기간 대비 증감 문구. 이전 값이 0이면 비율을 낼 수 없어 증가량만 보여 준다.
export function deltaText(current: number, previous: number, unit = "") {
  if (previous === 0) {
    if (current === 0) return "이전 기간과 같음";
    return `이전 기간 없음 (+${current.toLocaleString("ko-KR")}${unit})`;
  }
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% 이전 기간 대비`;
}

// 수치 카드: 라벨, 큰 숫자, 증감 문구, 일별 선 그래프(shadcn의 "Total Revenue" 카드 모양).
export function StatCard({
  label,
  value,
  note,
  points,
  warn,
}: {
  label: string;
  value: string;
  note: string;
  points: Point[];
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-3xl font-semibold tracking-tight tabular-nums", warn && "text-destructive")}>{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </div>
      <LineChart points={points} ariaLabel={`${label} 일별 추이`} />
    </div>
  );
}
