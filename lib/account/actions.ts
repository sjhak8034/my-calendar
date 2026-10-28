"use server";

import { redirect } from "next/navigation";
import { defaultLocale, hasLocale } from "@/lib/i18n/config";
import { unlinkKakaoForUser } from "@/lib/kakao/unlink-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/require-user";
import { emailMatches } from "./confirm";

export type DeleteAccountResult = {
  ok: false;
  code: "unauthorized" | "guest" | "mismatch" | "failed";
};

// 계정과 모든 데이터를 영구 삭제한다. 성공하면 로그인 화면으로 이동하므로 이 함수는 돌아오지 않고,
// 돌아왔다면 실패다. 일정·AI 대화·푸시 구독·카카오 토큰·알림 기록은 사용자(auth.users)에 걸린 FK cascade로 함께 지워진다.
// Server Action은 직접 POST로도 호출되므로 로그인과 이메일 확인을 서버에서 다시 확인한다.
// 브라우저의 푸시 구독 해제는 브라우저에서만 할 수 있어 화면이 이 액션을 부르기 전에 한다.
export async function deleteAccount(confirmEmail: unknown, lang: unknown): Promise<DeleteAccountResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  // 게스트는 로그아웃할 때 계정이 지워지는 기존 흐름(signOut)을 쓴다.
  if (session.user.is_anonymous === true) return { ok: false, code: "guest" };
  if (!emailMatches(confirmEmail, session.user.email)) return { ok: false, code: "mismatch" };

  const admin = createAdminClient();
  if (!admin) {
    console.error("[account] delete failed: SUPABASE_SERVICE_ROLE_KEY is not set");
    return { ok: false, code: "failed" };
  }

  // 카카오 쪽 연결 끊기는 계정이 사라지기 전에 해야 토큰을 쓸 수 있다(실패해도 계속).
  await unlinkKakaoForUser(session.user.id);

  const { error } = await admin.auth.admin.deleteUser(session.user.id);
  if (error) {
    console.error("[account] deleteUser failed:", error.code ?? "unknown", error.status ?? "");
    return { ok: false, code: "failed" };
  }

  // 계정은 이미 지워졌다. 남은 로그인 쿠키만 정리하고(서버가 거부해도 무시), 로그인 화면으로 보낸다.
  try {
    await session.supabase.auth.signOut();
  } catch {
    // 쿠키 정리 실패는 로그인 화면에서 세션이 무효로 처리된다.
  }
  redirect(`/${typeof lang === "string" && hasLocale(lang) ? lang : defaultLocale}/login`);
}
