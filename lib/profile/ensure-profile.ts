import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 로그인·가입 직후 서버가 profiles 행을 만들거나 이메일을 맞춘다(DB 트리거를 쓰지 않는다).
// profiles에는 사용자가 쓸 권한이 없어(자기 역할을 바꾸지 못하게) service role로 쓴다.
// upsert는 넘긴 컬럼(user_id, email)만 갱신하므로 이미 있는 role·membership은 그대로 둔다.
// 실패해도 로그인·가입을 막지 않는다: 행이 없으면 코드가 일반 사용자(user/free)로 처리하고, 다음 로그인 때 다시 시도한다.
export async function ensureProfile(user: { id: string; email?: string | null } | null | undefined) {
  if (!user) return;
  try {
    const admin = createAdminClient();
    if (!admin) {
      console.error("[profile] ensureProfile skipped: no service role key");
      return;
    }
    const { error } = await admin
      .from("profiles")
      .upsert({ user_id: user.id, email: user.email ?? null }, { onConflict: "user_id" });
    if (error) console.error("[profile] ensureProfile failed:", error.code ?? "unknown");
  } catch {
    console.error("[profile] ensureProfile threw");
  }
}
