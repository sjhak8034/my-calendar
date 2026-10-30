"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveCostLimit, type CostLimitState } from "@/app/admin/actions";
import { AI_COST_LIMIT_MAX, AI_COST_LIMIT_MIN, AI_COST_LIMIT_STEP } from "@/lib/ai/limits";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const krw = (n: number) => `${n < 100 ? n.toFixed(1) : fmt(Math.round(n))}원`;

// 대시보드 맨 위에 붙는 바: 사용자당 하루 AI 사용 금액(원) 한도를 슬라이더를 끌어 정한다(모든 사용자 공통). 저장해야 적용된다.
// 입력·출력 토큰의 단가가 달라 토큰 수 대신 금액으로 센다(AI 요금 단가를 저장해 둬야 계산된다).
// 아래 막대는 오늘 가장 많이 쓴 사용자의 사용 금액이 한도의 얼마인지 보여 준다.
export function CostLimitBar({
  initialLimit,
  todayMaxUserKrw,
  avgKrwPerQuestion,
  hasPricing,
  readError,
}: {
  initialLimit: number | null;
  todayMaxUserKrw: number;
  avgKrwPerQuestion: number;
  hasPricing: boolean;
  readError?: string;
}) {
  const [state, action, pending] = useActionState<CostLimitState, FormData>(saveCostLimit, {});
  // 저장된 값(서버 기준). 저장에 성공하면 그 값, 아니면 처음 받은 값이다.
  const saved = state.ok ? (state.saved ?? null) : initialLimit;
  const [limit, setLimit] = useState<number>(initialLimit ?? 100);
  const [unlimited, setUnlimited] = useState(initialLimit === null);
  const current = unlimited ? null : limit;
  const dirty = current !== saved;
  const ratio = current ? Math.min(1, todayMaxUserKrw / current) : 0;
  const approxQuestions = current && avgKrwPerQuestion > 0 ? Math.round(current / avgKrwPerQuestion) : null;
  const pct = ((limit - AI_COST_LIMIT_MIN) / (AI_COST_LIMIT_MAX - AI_COST_LIMIT_MIN)) * 100;

  return (
    <form
      action={action}
      aria-label="AI 사용 제한"
      className="sticky top-2 z-30 flex flex-col gap-3 rounded-xl border bg-card/95 p-4 shadow-md backdrop-blur"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">AI 사용 제한 · 사용자당 하루 최대 사용 금액</p>
          <p className="text-xs text-muted-foreground">
            모든 사용자에게 똑같이 적용됩니다. 입력·출력 토큰 단가로 계산한 예상 금액이며, 서울 0시 기준입니다. 넘으면 그 사용자는 다음 날까지 질문할 수 없습니다.
          </p>
        </div>
        <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", unlimited && "text-muted-foreground")}>
          {unlimited ? "제한 없음" : `${fmt(limit)}원`}
        </p>
      </div>

      {/* 슬라이더: 드래그로 조절. 값은 숨은 입력(limit)으로 보내고, 제한 없음이면 비워 보낸다. */}
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label="사용자당 하루 최대 사용 금액(원)"
          min={AI_COST_LIMIT_MIN}
          max={AI_COST_LIMIT_MAX}
          step={AI_COST_LIMIT_STEP}
          value={limit}
          disabled={unlimited}
          onChange={(e) => setLimit(Number(e.target.value))}
          style={{ background: unlimited ? undefined : `linear-gradient(to right, var(--primary) ${pct}%, var(--muted) ${pct}%)` }}
          className={cn(
            "h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow",
            "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-card",
            unlimited && "cursor-not-allowed opacity-50",
          )}
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs">
          <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} className="size-3.5 accent-primary" />
          제한 없음
        </label>
      </div>
      <input type="hidden" name="limit" value={current === null ? "" : String(current)} />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{fmt(AI_COST_LIMIT_MIN)}원</span>
        <span>{fmt(AI_COST_LIMIT_MAX)}원</span>
      </div>

      {!hasPricing && (
        <p role="note" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          AI 요금 단가(입력·출력 단가와 환율)를 아래에서 먼저 저장해야 금액을 계산할 수 있습니다. 저장하기 전에는 한도를 정해도 적용되지 않습니다.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {current ? (
            <>
              <p>
                오늘 가장 많이 쓴 사용자 {hasPricing ? `${krw(todayMaxUserKrw)} (${Math.round(ratio * 100)}%)` : "단가 미설정"}
                {approxQuestions !== null && ` · 질문 약 ${fmt(approxQuestions)}회 분량(최근 평균 ${krw(avgKrwPerQuestion)}/질문)`}
              </p>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span
                  className={cn("block h-full rounded-full", ratio >= 0.9 ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${Math.max(ratio > 0 ? 2 : 0, ratio * 100)}%` }}
                />
              </span>
            </>
          ) : (
            <p>금액 기준 제한이 없습니다(질문 횟수 제한 시간당 20회·하루 100회는 그대로 적용됩니다).</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {state.ok && !dirty && <span role="status" className="text-xs text-muted-foreground">저장했습니다. 바로 적용됩니다.</span>}
          {state.error && <span role="alert" className="text-xs text-destructive">{state.error}</span>}
          {readError && <span className="text-xs text-destructive">현재 값을 읽지 못했습니다: {readError}</span>}
          <Button type="submit" size="sm" disabled={pending || !dirty}>
            {pending ? "저장 중…" : "한도 저장"}
          </Button>
        </div>
      </div>
    </form>
  );
}
