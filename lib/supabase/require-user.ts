import "server-only";
import { createClient } from "./server";

// Server Action·Route Handler는 직접 호출될 수 있으므로 매번 로그인을 서버에서 확인한다.
// 로그인했으면 그 사용자의 쿠키로 만든 클라이언트(RLS 적용)와 사용자를, 아니면 null을 돌려준다.
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}
