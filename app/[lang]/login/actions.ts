"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";

// useActionState 상태. error는 현재 언어로 번역된 메시지다.
// email은 실패 후에도 입력값을 복원하기 위해 돌려준다(비밀번호는 제외).
export type ActionState = { error?: string; email?: string };

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
): "invalidCredentials" | "emailTaken" | "passwordTooShort" | "generic" {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "user_already_exists":
    case "email_exists":
      return "emailTaken";
    case "weak_password":
      return "passwordTooShort";
    default:
      return "generic";
  }
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

  redirect(`/${lang}`);
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
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: dict.errors[errorKey(error.code)], email };

  // 이메일 확인이 켜진 프로젝트에서는 이미 가입된 이메일이 identities 빈 배열로 응답된다.
  if (data.user?.identities?.length === 0) {
    return { error: dict.errors.emailTaken, email };
  }
  // 세션이 없으면(이메일 확인 필요 등) 자동 로그인할 수 없다.
  if (!data.session) return { error: dict.errors.generic, email };

  redirect(`/${lang}`);
}

export async function signInWithGoogle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = readLang(formData);
  const dict = await getDictionary(lang);

  // origin은 요청 헤더에서 계산한다(하드코딩 금지).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return { error: dict.errors.googleFailed };
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?lang=${lang}` },
  });
  if (error || !data.url) return { error: dict.errors.googleFailed };

  redirect(data.url);
}

export async function signOut(formData: FormData): Promise<void> {
  const lang = readLang(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${lang}/login`);
}
