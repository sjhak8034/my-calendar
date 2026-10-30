"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePricing, type PricingState } from "@/app/admin/actions";
import type { AiPricing } from "@/lib/admin/pricing";

// AI 요금 단가 입력·저장. 저장하면 위 예상 비용이 이 값으로 다시 계산된다.
export function PricingForm({ initial, updatedAt }: { initial: AiPricing | null; updatedAt: string | null }) {
  const [state, action, pending] = useActionState<PricingState, FormData>(savePricing, {});
  const fields = [
    { name: "inputUsdPerMillion", label: "입력 단가 ($ / 100만 토큰)", value: initial?.inputUsdPerMillion },
    { name: "outputUsdPerMillion", label: "출력 단가 ($ / 100만 토큰)", value: initial?.outputUsdPerMillion },
    { name: "usdKrw", label: "환율 (원 / 1달러)", value: initial?.usdKrw },
  ] as const;
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.name} className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`pricing-${f.name}`} className="text-xs">
              {f.label}
            </Label>
            <Input
              id={`pricing-${f.name}`}
              name={f.name}
              inputMode="decimal"
              autoComplete="off"
              defaultValue={f.value ?? ""}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "저장 중…" : "단가 저장"}
        </Button>
        {state.ok && <span role="status" className="text-xs text-muted-foreground">저장했습니다. 예상 비용에 반영됩니다.</span>}
        {state.error && <span role="alert" className="text-xs text-destructive">{state.error}</span>}
        {updatedAt && !state.ok && (
          <span className="text-xs text-muted-foreground">마지막 저장: {new Date(updatedAt).toLocaleString("ko-KR")}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        출력 토큰에는 추론(reasoning) 토큰을 더해 계산합니다. 요금은 모델 공급사의 요금표를 직접 확인해 입력하세요.
      </p>
    </form>
  );
}
