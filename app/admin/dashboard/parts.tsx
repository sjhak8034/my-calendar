import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function Tiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

export function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", warn && "text-destructive")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

type Bar = { label: string; value: number; display?: string };

// 일별 막대 목록. 라이브러리 없이 CSS 폭으로 그린다. 값은 항상 숫자로도 보여 막대 길이에만 의존하지 않는다.
export function BarList({ rows, unit = "" }: { rows: Bar[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-10 shrink-0 text-muted-foreground tabular-nums">{r.label}</span>
          <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted">
            <span
              className="block h-full rounded-sm bg-primary"
              style={{ width: `${r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }}
            />
          </span>
          <span className="w-16 shrink-0 text-right tabular-nums">
            {r.display ?? r.value.toLocaleString("ko-KR")}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        tone === "warn" ? "border-destructive/40 bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}
