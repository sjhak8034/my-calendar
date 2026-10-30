"use server";

import { revalidatePath } from "next/cache";
import { getAdmin } from "@/lib/admin/require-admin";
import { PRICING_KEY, PRICING_MAX, parsePricing } from "@/lib/admin/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

export type PricingState = { ok?: boolean; error?: string };

function readNumber(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// AI 요금 단가 저장. Server Action은 직접 POST로도 호출되므로 화면과 별개로 관리자 확인과 값 검증을 서버에서 다시 한다.
export async function savePricing(_prev: PricingState, formData: FormData): Promise<PricingState> {
  const admin = await getAdmin();
  if (!admin.ok) return { error: "권한이 없습니다." };

  const candidate = {
    inputUsdPerMillion: readNumber(formData, "inputUsdPerMillion"),
    outputUsdPerMillion: readNumber(formData, "outputUsdPerMillion"),
    usdKrw: readNumber(formData, "usdKrw"),
  };
  const pricing = parsePricing(candidate);
  if (!pricing) return { error: `세 값을 모두 0 이상 ${PRICING_MAX.toLocaleString()} 이하의 숫자로 입력하세요.` };
  if (pricing.usdKrw <= 0) return { error: "환율은 0보다 커야 합니다." };

  const client = createAdminClient();
  if (!client) return { error: "서버 설정(service role 키)이 없어 저장할 수 없습니다." };
  const { error } = await client
    .from("app_settings")
    .upsert({ key: PRICING_KEY, value: pricing, updated_at: new Date().toISOString(), updated_by: admin.userId }, { onConflict: "key" });
  if (error) {
    console.error("[admin] savePricing failed:", error.code ?? "unknown");
    return { error: "저장하지 못했습니다. 마이그레이션(20261102000003)을 적용했는지 확인하세요." };
  }
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
