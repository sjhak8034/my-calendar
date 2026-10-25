// 지원 로케일. 기본값은 ko. 클라이언트에서도 import 가능하도록 server-only를 쓰지 않는다.
export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ko";

// 언어 선택을 기억하는 쿠키 이름
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const hasLocale = (value: string | null | undefined): value is Locale =>
  !!value && (locales as readonly string[]).includes(value);
