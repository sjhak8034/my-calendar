"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUser } from "@/lib/supabase/require-user";
import { createClient } from "@/lib/supabase/server";

// useActionState 상태. error는 현재 언어로 번역된 메시지다.
// email은 실패 후에도 입력값을 복원하기 위해 돌려준다(비밀번호는 제외).
export type ActionState = { error?: string; notice?: string; email?: string };

const MIN_PASSWORD_LENGTH = 6;

function readLang(formData: FormData): Locale {
  const value = formData.get("lang");
  return typeof value === "string" && hasLocale(value) ? value : defaultLocale;
}

function readCredentials(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  return {
    email: typeof email === "string" ? email.trim() : "",
    password: typeof password === "string" ? password : "",
  };
}

// Supabase 원본 문구 대신 error.code로 사전 키를 고른다.
function errorKey(
  code: string | undefined,
): "invalidCredentials" | "emailNotConfirmed" | "emailTaken" | "passwordTooShort" | "generic" {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "emailTaken";
    case "weak_password":
      return "passwordTooShort";
    default:
      return "generic";
  }
}

// origin은 요청 헤더에서 계산한다(하드코딩 금지).
async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

export async function signInWithPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = readLang(formData);
  const dict = await getDictionary(lang);
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: dict.errors.invalidCredentials, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: dict.errors[errorKey(error.code)], email };

  redirect(`/${lang}/welcome`); // 인트로를 보여 주는 동안 그 뒤에서 캘린더로 이동한다
}

export async function signUp(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = readLang(formData);
  const dict = await getDictionary(lang);
  const { email, password } = readCredentials(formData);

  if (!email) return { error: dict.errors.generic, email };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: dict.errors.passwordTooShort, email };
  }

  const supabase = await createClient();
  // 이메일 확인이 켜져 있으면 메일의 링크가 이 주소로 돌아와 로그인을 마친다(/auth/callback이 인가 코드를 세션으로 바꾼다).
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback?lang=${lang}` } : undefined,
  });
  if (error) {
    // 사용자에게는 일반 문구만 보이므로 원인(오류 코드)을 서버 로그에 남긴다. 이메일·비밀번호는 남기지 않는다.
    console.error("[auth] signUp failed:", error.code ?? "unknown", error.status ?? "");
    return { error: dict.errors[errorKey(error.code)], email };
  }

  // 이메일 확인이 켜진 프로젝트에서는 이미 가입된 이메일이 identities 빈 배열로 응답된다.
  if (data.user?.identities?.length === 0) {
    return { error: dict.errors.emailTaken, email };
  }
  // 세션이 없으면 이메일 확인이 켜져 있어 확인 메일을 보낸 상태다. 오류가 아니라 안내를 보여 준다.
  if (!data.session) return { notice: dict.login.checkEmail, email };

  redirect(`/${lang}/welcome`); // 인트로를 보여 주는 동안 그 뒤에서 캘린더로 이동한다
}

export async function signInWithGoogle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = readLang(formData);
  const dict = await getDictionary(lang);

  const origin = await requestOrigin();
  if (!origin) return { error: dict.errors.googleFailed };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?lang=${lang}` },
  });
  if (error || !data.url) return { error: dict.errors.googleFailed };

  redirect(data.url);
}

// 게스트로 시작: 익명 로그인(Supabase 대시보드에서 "Allow anonymous sign-ins"를 켜야 한다).
export async function signInAsGuest(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = readLang(formData);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    // 원인(예: anonymous_provider_disabled)은 화면에 보이지 않으므로 코드와 상태만 서버 로그에 남긴다.
    console.error("[auth] guest sign-in failed:", error?.code ?? "no_session", error?.status ?? "");
    return { error: dict.errors.guestFailed };
  }

  redirect(`/${lang}/welcome`); // 인트로를 보여 주는 동안 그 뒤에서 캘린더로 이동한다
}

// 게스트 → 정식 계정 전환(이메일). 같은 user.id가 유지되어 일정·AI 대화가 그대로 이어진다.
// 일반 사용자가 이메일 변경 엔드포인트로 쓰지 못하게 서버에서 게스트인지 다시 확인한다.
export async function upgradeWithEmail(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = readLang(formData);
  const dict = await getDictionary(lang);
  const { email, password } = readCredentials(formData);

  const session = await requireUser();
  if (!session || session.user.is_anonymous !== true) redirect(`/${lang}`);

  if (!email) return { error: dict.errors.generic, email };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: dict.errors.passwordTooShort, email };
  }

  const { supabase } = session;
  const { error } = await supabase.auth.updateUser({ email, password });
  if (error) return { error: dict.errors[errorKey(error.code)], email };

  // 새 토큰을 받아 is_anonymous 값을 갱신한다(AI 게스트 한도가 남지 않게).
  await supabase.auth.refreshSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 이메일 확인이 켜진 프로젝트에서는 확인 전까지 게스트로 남는다.
  if (user?.is_anonymous) return { notice: dict.upgrade.checkEmail, email };

  redirect(`/${lang}`);
}

// 게스트 → 정식 계정 전환(Google 연결). Supabase의 "Manual linking" 설정이 필요하다.
export async function upgradeWithGoogle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = readLang(formData);
  const dict = await getDictionary(lang);

  const session = await requireUser();
  if (!session || session.user.is_anonymous !== true) redirect(`/${lang}`);

  const origin = await requestOrigin();
  if (!origin) return { error: dict.errors.googleFailed };

  // 복귀 주소의 upgrade=1은 /auth/callback이 인트로 없이 홈으로 보내고, 실패 시 /upgrade 로 되돌리는 표시다.
  const callback = new URLSearchParams({ lang, next: `/${lang}`, upgrade: "1" });
  const { data, error } = await session.supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?${callback}` },
  });
  if (error || !data.url) {
    return {
      error:
        error?.code === "identity_already_exists"
          ? dict.errors.identityExists
          : dict.errors.googleFailed,
    };
  }

  redirect(data.url);
}

export async function signOut(formData: FormData): Promise<void> {
  const lang = readLang(formData);
  const supabase = await createClient();

  // 게스트는 로그아웃하면 다시 들어올 수 없으므로 계정과 데이터를 바로 지운다(일반 계정은 DB 함수가 거부).
  // 실패해도 로그아웃은 진행한다. 남은 데이터는 30일 정리(purge_inactive_guests)가 지운다.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.is_anonymous) {
    const { error } = await supabase.rpc("delete_guest_account");
    if (error) console.error("[auth] delete_guest_account failed:", error.message);
  }

  await supabase.auth.signOut();
  redirect(`/${lang}/login`);
}
