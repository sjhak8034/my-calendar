import "server-only";
import { cache } from "react";
import { createClient } from "./server";

// 같은 화면 요청 안에서 레이아웃·사이드바·페이지가 여러 번 불러도 Auth 서버 확인(getUser)은 한 번만 한다.
// React cache는 렌더 밖(Server Action 등)에서는 저장하지 않으므로 거기서는 매번 새로 확인한다.
const loadUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
});

// Server Action·Route Handler는 직접 호출될 수 있으므로 매번 로그인을 서버에서 확인한다.
// 로그인했으면 그 사용자의 쿠키로 만든 클라이언트(RLS 적용)와 사용자를, 아니면 null을 돌려준다.
export async function requireUser() {
  return loadUser();
}
