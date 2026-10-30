import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// proxy에서 세션 쿠키를 갱신하고 로그인 여부를 확인한다.
// 요청마다 도는 곳이라 getClaims()를 쓴다. 토큰 서명을 서버에서 직접 검증하므로 Auth 서버 왕복이 없다
// (서명 키가 구형(대칭)이면 라이브러리가 getUser()와 같은 방식으로 되돌아간다). 토큰이 만료됐으면 갱신 후 쿠키를 다시 쓴다.
// 로그아웃·삭제 같은 취소는 토큰 만료(보통 1시간)까지 이 단계에서는 반영되지 않는다. 여기는 로그인 화면으로 보내는 용도일 뿐이고,
// 데이터 접근은 페이지·서버 액션의 requireUser()(getUser)와 DB의 RLS가 따로 막는다. getSession은 쿠키만 읽어 쓰지 않는다.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  // supabaseResponse는 setAll로 교체될 수 있으므로 호출 시점의 최신 값을 반환한다.
  return { user, response: supabaseResponse, supabase };
}
