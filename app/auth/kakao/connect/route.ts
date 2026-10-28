import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale } from "@/lib/i18n/config";
import { buildAuthorizeUrl } from "@/lib/kakao/client";
import { kakaoConfig } from "@/lib/kakao/config";
import { STATE_COOKIE, STATE_MAX_AGE_SECONDS, newState, stateCookieValue } from "@/lib/kakao/oauth";
import type { ConnectResult } from "@/lib/kakao/types";
import { requireUser } from "@/lib/supabase/require-user";

// GET /auth/kakao/connect?lang=ko: 설정 화면의 "연결하기"가 이리로 보낸다.
// 로그인한 사용자만 쓸 수 있고, state를 쿠키에 심은 뒤 카카오 동의 화면으로 이동한다.
// proxy.ts matcher가 /auth/* 를 제외하므로 이 라우트가 스스로 로그인을 확인한다(app/auth/callback과 같은 방식).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const langParam = searchParams.get("lang");
  const lang = hasLocale(langParam) ? langParam : defaultLocale;
  const toSettings = (result: ConnectResult) =>
    NextResponse.redirect(new URL(`/${lang}/settings?kakao=${result}`, origin));

  if (!(await requireUser())) return NextResponse.redirect(new URL(`/${lang}/login`, origin));

  const config = kakaoConfig();
  if (!config) return toSettings("notConfigured");
  // state 쿠키는 이 주소에만 붙는다. 카카오에 등록한 Redirect URI(SITE_URL)와 다른 주소로 시작하면 돌아올 때 쿠키가 없어 실패한다.
  if (origin !== config.siteUrl) return toSettings("origin");

  const state = newState();
  const response = NextResponse.redirect(buildAuthorizeUrl(config, state));
  response.cookies.set(STATE_COOKIE, stateCookieValue(state, lang), {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax", // 카카오에서 돌아오는 최상위 이동(GET)에는 보내진다.
    path: "/auth/kakao",
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return response;
}
