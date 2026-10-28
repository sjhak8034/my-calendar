import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/kakao/client";
import { kakaoConfig } from "@/lib/kakao/config";
import { encryptToken } from "@/lib/kakao/crypto";
import { STATE_COOKIE, parseStateCookie, sameState } from "@/lib/kakao/oauth";
import type { ConnectResult } from "@/lib/kakao/types";
import { defaultLocale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/require-user";

// GET /auth/kakao/callback: 카카오 동의 화면에서 돌아오는 곳(콘솔에 등록한 Redirect URI).
// state를 검증하고 인가 코드를 토큰으로 바꿔 암호화해 저장한 뒤 설정 화면으로 보낸다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const saved = parseStateCookie(request.cookies.get(STATE_COOKIE)?.value);
  const lang = saved?.lang ?? defaultLocale;

  // state 쿠키는 한 번 쓰면 어떤 결과든 지운다.
  const finish = (target: string) => {
    const response = NextResponse.redirect(new URL(target, origin));
    response.cookies.delete({ name: STATE_COOKIE, path: "/auth/kakao" });
    return response;
  };
  const toSettings = (result: ConnectResult) => finish(`/${lang}/settings?kakao=${result}`);

  const session = await requireUser();
  if (!session) return finish(`/${lang}/login`);

  // CSRF 방어: 연결을 시작할 때 심은 state와 카카오가 돌려준 state가 같아야 한다.
  const state = searchParams.get("state");
  if (!saved || !state || !sameState(saved.state, state)) return toSettings("failed");

  // 사용자가 동의 화면에서 취소하면 error=access_denied로 돌아온다.
  if (searchParams.get("error")) return toSettings("denied");
  const code = searchParams.get("code");
  if (!code) return toSettings("failed");

  const config = kakaoConfig();
  const admin = createAdminClient();
  if (!config || !admin) return toSettings("notConfigured");

  const exchanged = await exchangeCode(config, code);
  if (!exchanged.ok) {
    console.error("[kakao] code exchange failed:", exchanged.reason, exchanged.status ?? "");
    return toSettings("failed");
  }
  const { accessToken, refreshToken, expiresIn, refreshExpiresIn, scope } = exchanged.value;
  // 발송에는 리프레시 토큰이 필요하다. 동의 항목(scope)이 응답에 있으면 talk_message가 포함돼야 한다.
  if (!refreshToken) return toSettings("failed");
  if (scope && !scope.split(" ").includes("talk_message")) return toSettings("denied");

  const now = Date.now();
  const { error } = await admin.from("kakao_tokens").upsert(
    {
      user_id: session.user.id,
      access_token_enc: encryptToken(accessToken, session.user.id, config.encryptionKey),
      refresh_token_enc: encryptToken(refreshToken, session.user.id, config.encryptionKey),
      expires_at: new Date(now + expiresIn * 1000).toISOString(),
      refresh_expires_at: refreshExpiresIn ? new Date(now + refreshExpiresIn * 1000).toISOString() : null,
      lang,
      needs_reconnect: false,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[kakao] save tokens failed:", error.message);
    return toSettings("failed");
  }
  return toSettings("connected");
}
