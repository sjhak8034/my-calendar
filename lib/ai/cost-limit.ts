import "server-only";
import { toSeoulDateTime } from "@/lib/calendar";
import { AI_COST_LIMIT_MAX, AI_COST_LIMIT_MIN } from "@/lib/ai/limits";
import { estimateCost, getPricing } from "@/lib/admin/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

// 사용자당 하루 AI 사용 금액 제한(원). 모든 사용자에게 같은 값이 적용되고 관리자가 대시보드 슬라이더로 정한다(app_settings 'ai_cost_limit').
// 입력·출력 토큰의 단가가 달라 토큰 수 대신 금액으로 센다: 금액 = 관리자가 저장한 AI 요금 단가(app_settings 'ai_pricing')로 계산한 예상 비용.
// 하루는 서울 0시 기준이고, 사용량은 ai_usage(질문이 끝난 뒤 기록)의 합계라 한도를 넘긴 질문 하나는 끝까지 처리될 수 있다.
export const COST_LIMIT_KEY = "ai_cost_limit";

export function parseCostLimit(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const n = (value as Record<string, unknown>).dailyKrwPerUser;
  if (typeof n !== "number" || !Number.isInteger(n) || n < AI_COST_LIMIT_MIN || n > AI_COST_LIMIT_MAX) return null;
  return n;
}

// 설정이 없거나 읽지 못하면 null(제한 없음). 읽기 실패로 서비스를 막지 않으려고 실패 시에도 통과시킨다.
export async function getDailyCostLimit(): Promise<{ limit: number | null; updatedAt: string | null; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { limit: null, updatedAt: null, error: "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다." };
  const { data, error } = await admin.from("app_settings").select("value, updated_at").eq("key", COST_LIMIT_KEY).maybeSingle();
  if (error) return { limit: null, updatedAt: null, error: error.message };
  return { limit: parseCostLimit(data?.value), updatedAt: data?.updated_at ?? null };
}

// 오늘(서울 0시부터) 이 사용자가 쓴 예상 금액과 한도. 한도가 없거나, 단가가 저장돼 있지 않거나, 조회에 실패하면 null(적용하지 않음).
// 한도가 없거나 계산할 수 없을 때 막지 않는 것은 서비스 가용성을 우선하기 위해서다(실패는 로그만 남긴다).
export async function getTodayCostStatus(userId: string): Promise<{ limit: number; costKrw: number } | null> {
  const { limit, error } = await getDailyCostLimit();
  if (error) console.error("[ai] cost limit lookup failed:", error);
  if (limit === null) return null;

  const { pricing, error: pricingError } = await getPricing();
  if (pricingError) console.error("[ai] pricing lookup failed:", pricingError);
  // 단가가 없으면 금액을 계산할 수 없어 한도를 적용하지 못한다(대시보드 바에 안내가 뜬다).
  if (!pricing) return null;

  const admin = createAdminClient();
  if (!admin) return null;
  const since = `${toSeoulDateTime(new Date().toISOString()).date}T00:00:00+09:00`;
  const { data, error: usageError } = await admin
    .from("ai_usage")
    .select("prompt_tokens, completion_tokens, reasoning_tokens")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(2000);
  if (usageError) {
    console.error("[ai] usage lookup failed:", usageError.message);
    return null;
  }
  const total = data.reduce(
    (a, r) => ({ prompt: a.prompt + r.prompt_tokens, completion: a.completion + r.completion_tokens, reasoning: a.reasoning + r.reasoning_tokens }),
    { prompt: 0, completion: 0, reasoning: 0 },
  );
  const cost = estimateCost(total, pricing);
  return cost ? { limit, costKrw: cost.krw } : null;
}

// 질문을 받기 전에 확인한다.
export async function isOverDailyCostLimit(userId: string): Promise<boolean> {
  const status = await getTodayCostStatus(userId);
  return status !== null && status.costKrw >= status.limit;
}
