import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// RLS를 우회하는 service role 클라이언트. 사용자 요청이 아니라 서버가 스스로 하는 작업(알림 발송 워커 등)에서만 쓴다.
// SUPABASE_SERVICE_ROLE_KEY는 브라우저에 노출되면 안 되므로 NEXT_PUBLIC_ 접두사를 붙이지 않는다.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
