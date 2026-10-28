"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { defaultLocale, hasLocale } from "@/lib/i18n/config";
import { unlinkKakaoForUser } from "@/lib/kakao/unlink-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/require-user";
import { emailMatches, hasPasswordLogin } from "./confirm";

export type DeleteAccountResult = {
  ok: false;
  code: "unauthorized" | "guest" | "mismatch" | "captcha" | "rateLimited" | "failed";
};

// 계정과 모든 데이터를 영구 삭제한다. 성공하면 로그인 화면으로 이동하므로 이 함수는 돌아오지 않고,
// 돌아왔다면 실패다. 일정·AI 대화·푸시 구독·카카오 토큰·알림 기록은 사용자(auth.users)에 걸린 FK cascade로 함께 지워진다.
// 확인 방법: 비밀번호로 로그인하는 계정은 비밀번호를, Google로만 가입한 계정은 이메일 입력을 받는다.
// Server Action은 직접 POST로도 호출되므로 로그인과 확인을 서버에서 다시 한다.
// 브라우저의 푸시 구독 해제는 브라우저에서만 할 수 있어 화면이 이 액션을 부르기 전에 한다.
export async function deleteAccount(
  confirmation: unknown,
  lang: unknown,
  captchaToken?: unknown,
): Promise<DeleteAccountResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  // 게스트는 로그아웃할 때 계정이 지워지는 기존 흐름(signOut)을 쓴다.
  if (session.user.is_anonymous === true) return { ok: false, code: "guest" };
  if (hasPasswordLogin(session.user)) {
    const checked = await verifyPassword(session.user.email, confirmation, captchaToken);
    if (checked !== "ok") return { ok: false, code: checked };
  } else if (!emailMatches(confirmation, session.user.email)) {
    return { ok: false, code: "mismatch" };
  }

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

// 입력한 비밀번호가 맞는지 확인한다. 쿠키·세션을 건드리지 않는 별도 클라이언트로 로그인을 시도할 뿐이고(성공해도 저장하지 않는다),
// Supabase의 CAPTCHA 보호가 켜져 있으면 로그인과 같이 토큰이 필요하다. 비밀번호는 로그에 남기지 않는다.
async function verifyPassword(
  email: string | undefined,
  password: unknown,
  captchaToken: unknown,
): Promise<"ok" | "mismatch" | "captcha" | "rateLimited" | "failed"> {
  if (!email || typeof password !== "string" || password.length === 0 || password.length > 256) return "mismatch";
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { error } = await verifier.auth.signInWithPassword({
    email,
    password,
    options: {
      captchaToken:
        typeof captchaToken === "string" && captchaToken.length > 0 && captchaToken.length <= 4096
          ? captchaToken
          : undefined,
    },
  });
  if (!error) return "ok";
  console.error("[account] password check failed:", error.code ?? "unknown", error.status ?? "");
  switch (error.code) {
    case "invalid_credentials":
      return "mismatch";
    case "captcha_failed":
      return "captcha";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
    default:
      return "failed";
  }
}
