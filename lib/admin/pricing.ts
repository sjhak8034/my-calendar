import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// AI 요금 단가. 관리자가 대시보드에서 입력해 app_settings('ai_pricing')에 저장하고, 예상 비용 계산에 쓴다.
// 입력·출력 단가는 100만 토큰당 달러, 환율은 1달러당 원. 출력 토큰에는 추론(reasoning) 토큰을 더해 계산한다(Gemini는 추론 토큰도 출력으로 청구).
export type AiPricing = { inputUsdPerMillion: number; outputUsdPerMillion: number; usdKrw: number };

export const PRICING_KEY = "ai_pricing";
export const PRICING_MAX = 100_000;

export function parsePricing(value: unknown): AiPricing | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= PRICING_MAX;
  if (!ok(v.inputUsdPerMillion) || !ok(v.outputUsdPerMillion) || !ok(v.usdKrw)) return null;
  return { inputUsdPerMillion: v.inputUsdPerMillion, outputUsdPerMillion: v.outputUsdPerMillion, usdKrw: v.usdKrw };
}

export async function getPricing(): Promise<{ pricing: AiPricing | null; updatedAt: string | null; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { pricing: null, updatedAt: null, error: "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다." };
  const { data, error } = await admin
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", PRICING_KEY)
    .maybeSingle();
  if (error) return { pricing: null, updatedAt: null, error: error.message };
  return { pricing: parsePricing(data?.value), updatedAt: data?.updated_at ?? null };
}

export type Tokens = { prompt: number; completion: number; reasoning: number };

// 토큰 수 → 예상 비용(달러, 원). 단가가 없으면 null.
export function estimateCost(tokens: Tokens, pricing: AiPricing | null): { usd: number; krw: number } | null {
  if (!pricing) return null;
  const usd =
    (tokens.prompt * pricing.inputUsdPerMillion + (tokens.completion + tokens.reasoning) * pricing.outputUsdPerMillion) /
    1_000_000;
  return { usd, krw: usd * pricing.usdKrw };
}
