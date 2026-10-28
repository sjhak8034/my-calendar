import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { kakaoConfig } from "./config";
import type { KakaoStatus } from "./types";

// 설정 화면에 보여 줄 카카오 연결 상태. kakao_tokens는 service role만 읽을 수 있어 서버에서 본인 행만 조회한다.
export async function getKakaoStatus(userId: string): Promise<KakaoStatus> {
  const admin = createAdminClient();
  if (!kakaoConfig() || !admin) return "not_configured";
  const { data, error } = await admin
    .from("kakao_tokens")
    .select("needs_reconnect")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // 상태를 못 읽어도 설정 화면 전체가 막히지 않게 연결 안 됨으로 보여 준다.
    console.error("[kakao] status query failed:", error.message);
    return "disconnected";
  }
  if (!data) return "disconnected";
  return data.needs_reconnect ? "reconnect_required" : "connected";
}
