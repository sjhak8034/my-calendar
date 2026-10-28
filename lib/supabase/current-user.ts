import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "./server";

// 화면에 보여 줄 현재 사용자 정보. 사이드바·모바일 시트·푸시 복원이 같은 요청에서 여러 번 부르므로 요청당 한 번만 조회한다.
export const getCurrentUser = cache(async () => {
  // Supabase 세션 확인이 Date.now()를 쓰므로 요청 시점으로 미룬다(cacheComponents).
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return {
    email: user?.email ?? "",
    isGuest: user?.is_anonymous === true,
    // 이 계정이 웹 푸시를 켜 둔 상태인지(브라우저 구독과 별개. 로그아웃으로 구독이 해제돼도 유지된다).
    pushEnabled: user?.user_metadata?.push_enabled === true,
  };
});
