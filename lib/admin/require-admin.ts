import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/supabase/require-user";

export type AdminReason = "no-session" | "guest" | "lookup-failed" | "not-admin";

export type AdminResult =
  | { ok: true; userId: string; email: string; membership: string }
  | { ok: false; reason: AdminReason; detail?: string };

// 관리자 확인. 화면(페이지)과 관리자 Server Action이 모두 직접 부른다:
// layout은 화면 이동 때 다시 그려지지 않으므로 layout에서만 막으면 우회된다.
// 서명 검사만 하는 proxy(getClaims)와 달리 여기서는 Auth 서버에 확인(getUser)한 사용자로 판단한다.
// 역할은 사용자 자신의 권한으로 자기 행만 읽는다(RLS). 행이 없으면 일반 사용자다.
export const getAdmin = cache(async (): Promise<AdminResult> => {
  const auth = await requireUser();
  if (!auth) return { ok: false, reason: "no-session" };
  // 게스트(익명 로그인)는 관리자가 될 수 없다.
  if (auth.user.is_anonymous) return { ok: false, reason: "guest" };

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("role, membership")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "lookup-failed", detail: error.message };
  if (data?.role !== "admin") return { ok: false, reason: "not-admin" };
  return {
    ok: true,
    userId: auth.user.id,
    email: auth.user.email ?? "",
    membership: data.membership ?? "free",
  };
});
