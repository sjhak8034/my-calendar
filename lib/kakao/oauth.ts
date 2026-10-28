import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n/config";

// 카카오 연결 OAuth의 state(CSRF 방어) 쿠키. 카카오는 돌아올 때 code와 state만 돌려주므로
// 연결을 시작한 화면 언어도 이 쿠키에 함께 담는다. 값 형식: "<state>.<lang>" (state는 base64url이라 '.'이 없다).
export const STATE_COOKIE = "kakao_oauth_state";
export const STATE_MAX_AGE_SECONDS = 600;

export function newState(): string {
  return randomBytes(32).toString("base64url");
}

export function stateCookieValue(state: string, lang: Locale): string {
  return `${state}.${lang}`;
}

export function parseStateCookie(value: string | undefined): { state: string; lang: Locale } | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const lang = value.slice(dot + 1);
  return { state: value.slice(0, dot), lang: hasLocale(lang) ? lang : defaultLocale };
}

// 시간이 일정한 비교(응답 시간으로 값을 추측하지 못하게 한다).
export function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
