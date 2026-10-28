import "server-only";
import type { requireUser } from "@/lib/supabase/require-user";

type Supabase = NonNullable<Awaited<ReturnType<typeof requireUser>>>["supabase"];

// DB 함수 rate_limit_hit의 kind와 같아야 한다(20261031000003_hardening.sql).
export type RateLimitKind = "push_test" | "kakao_test";

// 최근 windowSeconds초 안에 이 사용자의 kind 요청이 max개 미만이면 1건을 기록하고 "ok", 넘으면 "limited", DB 오류면 "error".
// 한도 값은 서버 액션이 정해 넘긴다(브라우저가 정하지 않는다).
export async function hitRateLimit(
  supabase: Supabase,
  kind: RateLimitKind,
  max: number,
  windowSeconds: number,
): Promise<"ok" | "limited" | "error"> {
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_kind: kind,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] failed:", kind, error.code ?? "unknown");
    return "error";
  }
  return data === true ? "ok" : "limited";
}
