import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

// 오픈 리다이렉트 방지: 제어문자가 있으면 거부하고, URL로 파싱한 결과의 origin이 같은 경로만 허용한다.
// URL 파서는 탭·개행을 제거하므로("/\t/evil.com" → "//evil.com") 문자열 검사만으로는 막을 수 없다.
function safeNextPath(next: string | null, origin: string): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return null;
    const path = url.pathname + url.search;
    // 정규화 결과가 "//"로 시작하면 다시 URL을 만들 때 외부 호스트로 해석된다("/..//evil.com")
    return path.startsWith("//") ? null : path;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const langParam = searchParams.get("lang");
  const lang = hasLocale(langParam) ? langParam : defaultLocale;
  const code = searchParams.get("code");
  // 게스트의 Google 연결(upgradeWithGoogle)에서 돌아온 요청
  const upgrade = searchParams.get("upgrade") === "1";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = safeNextPath(searchParams.get("next"), origin);
      // 이미 로그인한 상태의 전환이라 인트로 없이 바로 보낸다.
      if (upgrade) return NextResponse.redirect(new URL(next ?? `/${lang}`, origin));
      // 환영 페이지(빈 배경)로 보내 인트로를 보여 주고, 그 뒤에서 원래 가려던 곳(없으면 캘린더)으로 이동한다.
      // 풀 로드라도 서버 HTML이 배경뿐이라 첫 페인트에 캘린더가 비치지 않는다.
      const target = new URL(`/${lang}/welcome`, origin);
      if (next) target.searchParams.set("next", next);
      return NextResponse.redirect(target);
    }
  }

  if (upgrade) {
    // 연결 실패(예: 이미 다른 계정에 연결된 Google 계정)는 게스트가 그대로 로그인된 상태라 전환 화면으로 되돌린다.
    const reason =
      searchParams.get("error_code") === "identity_already_exists" ? "identity" : "google";
    return NextResponse.redirect(new URL(`/${lang}/upgrade?error=${reason}`, origin));
  }

  return NextResponse.redirect(new URL(`/${lang}/login?error=oauth`, origin));
}
