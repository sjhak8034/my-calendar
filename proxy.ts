import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  hasLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/lib/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

// 비로그인에게도 열어 두는 경로(언어 접두사 제외)
const PUBLIC_PATHS = ["/login", "/privacy"];

// Accept-Language를 q 값 순으로 훑어 지원 로케일(ko-KR -> ko)을 찾는다.
function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const weight = q ? Number(q.trim().slice(2)) : 1;
      return { base: tag.trim().toLowerCase().split("-")[0], weight };
    })
    .filter((c) => c.base && !Number.isNaN(c.weight) && c.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const match = candidates.find((c) => hasLocale(c.base));
  return match && hasLocale(match.base) ? match.base : null;
}

// 쿠키 -> Accept-Language -> 기본값 순으로 언어를 결정한다(URL에 언어가 없을 때).
function negotiateLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(cookie)) return cookie;
  return (
    fromAcceptLanguage(request.headers.get("accept-language")) ?? defaultLocale
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 알림 발송용: Supabase pg_cron이 1분마다 호출하는 경로라 로그인 쿠키가 없다.
  // 공유 비밀로 호출하는 이 경로는 로그인 검사 없이 통과시킨다(막으면 알림이 발송되지 않는다).
  // 이 경로의 라우트는 반드시 스스로 비밀 헤더를 검증해야 한다(app/api/cron/notify/route.ts).
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  // API 경로(/api/*)는 언어 접두사·로그인 화면 이동 없이 세션만 갱신하고, 비로그인은 401 JSON으로 막는다.
  // 각 라우트도 스스로 로그인을 다시 확인한다.
  if (pathname.startsWith("/api/")) {
    const { user, response } = await updateSession(request);
    if (!user) {
      return NextResponse.json(
        { code: "unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    return response;
  }

  const segments = pathname.split("/");
  const rawLang = segments[1];
  const urlLang = rawLang.toLowerCase();

  // 대문자 로케일(/KO/login)은 소문자 경로로 정규화해 리다이렉트
  if (rawLang !== urlLang && hasLocale(urlLang)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${urlLang}${segments.slice(2).map((s) => `/${s}`).join("")}`;
    return NextResponse.redirect(url);
  }

  // 1) 언어 없는 경로는 결정된 언어로 리다이렉트
  if (!hasLocale(urlLang)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${negotiateLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const lang = urlLang;
  const subPath = "/" + segments.slice(2).join("/");
  const isPublic = PUBLIC_PATHS.some(
    (p) => subPath === p || subPath === `${p}/`,
  );
  const isLogin = subPath === "/login" || subPath === "/login/";

  // 2) 세션 갱신 + 3) 접근 제어
  const { user, response } = await updateSession(request);

  let result = response;
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}/login`;
    url.search = "";
    result = NextResponse.redirect(url);
  } else if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}`;
    url.search = "";
    result = NextResponse.redirect(url);
  }

  // 갱신된 세션 쿠키를 리다이렉트 응답에도 전달
  if (result !== response) {
    response.cookies.getAll().forEach((c) => result.cookies.set(c));
  }

  // 마지막으로 본 언어를 기억
  if (request.cookies.get(LOCALE_COOKIE)?.value !== lang) {
    result.cookies.set(LOCALE_COOKIE, lang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return result;
}

export const config = {
  matcher: [
    // _next, /auth/*, 확장자가 있는 정적 파일 제외
    "/((?!_next|auth/|.*\\..*).*)",
  ],
};

