import "server-only";
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "./client";
import { kakaoConfig } from "./config";
import { decryptToken, encryptToken } from "./crypto";

// 만료 5분 전부터는 미리 갱신한다(발송 중에 만료되지 않게).
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type AccessTokenResult =
  | { ok: true; accessToken: string; lang: Locale }
  | {
      ok: false;
      // not_configured: 환경변수 없음, not_connected: 연결 안 함, reconnect_required: 토큰이 만료·철회돼 다시 연결해야 함,
      // refresh_failed: 일시적인 오류(네트워크·카카오 서버)로 갱신하지 못함
      reason: "not_configured" | "not_connected" | "reconnect_required" | "refresh_failed";
    };

// 같은 사용자의 갱신 요청이 동시에 여러 번 가지 않게 한 번으로 합친다(워커가 한 사용자의 알림 여러 건을 병렬로 처리한다).
const inflight = new Map<string, Promise<AccessTokenResult>>();

// 사용자의 카카오 액세스 토큰을 돌려준다. 만료가 가까우면(또는 forceRefresh면) 갱신해 다시 저장한다.
// 저장된 행을 읽지 못하면 던진다(워커가 failed로 기록한다).
export function getAccessToken(userId: string, options: { forceRefresh?: boolean } = {}): Promise<AccessTokenResult> {
  const pending = inflight.get(userId);
  if (pending) return pending;
  const run = load(userId, options.forceRefresh === true).finally(() => inflight.delete(userId));
  inflight.set(userId, run);
  return run;
}

// 토큰이 만료·철회됐거나 동의가 취소돼 다시 연결해야 하는 상태로 표시한다. 설정 화면이 재연결을 안내한다.
export async function markReconnectRequired(userId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from("kakao_tokens")
    .update({ needs_reconnect: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) console.error("[kakao] mark reconnect failed:", error.message);
}

async function load(userId: string, forceRefresh: boolean): Promise<AccessTokenResult> {
  const config = kakaoConfig();
  const admin = createAdminClient();
  if (!config || !admin) return { ok: false, reason: "not_configured" };

  const { data: row, error } = await admin
    .from("kakao_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at, needs_reconnect, lang")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`kakao_tokens query failed: ${error.message}`);
  if (!row) return { ok: false, reason: "not_connected" };
  if (row.needs_reconnect) return { ok: false, reason: "reconnect_required" };

  const accessToken = decryptToken(row.access_token_enc, userId, config.encryptionKey);
  const refreshToken = decryptToken(row.refresh_token_enc, userId, config.encryptionKey);
  if (!accessToken || !refreshToken) {
    // 암호화 키가 바뀌었거나 값이 손상됐다. 다시 연결하는 수밖에 없다.
    await markReconnectRequired(userId);
    return { ok: false, reason: "reconnect_required" };
  }
  const lang = hasLocale(row.lang) ? row.lang : defaultLocale;

  if (!forceRefresh && Date.parse(row.expires_at) - Date.now() > REFRESH_MARGIN_MS) {
    return { ok: true, accessToken, lang };
  }

  const refreshed = await refreshAccessToken(config, refreshToken);
  if (!refreshed.ok) {
    if (refreshed.reason === "unauthorized") {
      await markReconnectRequired(userId);
      return { ok: false, reason: "reconnect_required" };
    }
    console.error("[kakao] refresh failed:", refreshed.reason, refreshed.status ?? "");
    return { ok: false, reason: "refresh_failed" };
  }

  const { value } = refreshed;
  const now = Date.now();
  const update: Record<string, string> = {
    access_token_enc: encryptToken(value.accessToken, userId, config.encryptionKey),
    expires_at: new Date(now + value.expiresIn * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
  // 새 리프레시 토큰은 기존 것의 남은 기간이 1개월 미만일 때만 온다. 없으면 기존 것을 계속 쓴다.
  if (value.refreshToken) {
    update.refresh_token_enc = encryptToken(value.refreshToken, userId, config.encryptionKey);
    if (value.refreshExpiresIn) {
      update.refresh_expires_at = new Date(now + value.refreshExpiresIn * 1000).toISOString();
    }
  }
  const { error: saveError } = await admin.from("kakao_tokens").update(update).eq("user_id", userId);
  // 저장에 실패해도 방금 받은 토큰은 쓸 수 있다. 다음 발송 때 다시 갱신한다.
  if (saveError) console.error("[kakao] save refreshed token failed:", saveError.message);
  return { ok: true, accessToken: value.accessToken, lang };
}
