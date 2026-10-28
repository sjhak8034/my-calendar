"use server";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import { sendKakaoToUser } from "@/lib/notify/kakao";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/require-user";
import { unlink } from "./client";
import { getAccessToken } from "./tokens";

export type KakaoActionResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "notConfigured" | "notConnected" | "reconnect" | "failed" };

// 카카오 연결을 끊는다. 카카오 쪽(동의 철회·토큰 폐기)은 할 수 있으면 하고, 실패해도 우리 쪽 토큰은 지운다.
// Server Action은 직접 POST로도 호출되므로 로그인을 서버에서 확인하고 본인 행만 다룬다.
export async function disconnectKakao(): Promise<KakaoActionResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  const admin = createAdminClient();
  if (!admin) return { ok: false, code: "failed" };

  try {
    const token = await getAccessToken(session.user.id);
    if (token.ok) await unlink(token.accessToken);
  } catch (e) {
    console.error("[kakao] unlink skipped:", e instanceof Error ? e.name : "error");
  }

  const { error } = await admin.from("kakao_tokens").delete().eq("user_id", session.user.id);
  if (error) {
    console.error("[kakao] disconnect failed:", error.message);
    return { ok: false, code: "failed" };
  }
  return { ok: true };
}

// 설정 화면의 "테스트 메시지 보내기": 본인의 나와의 채팅으로만 보낸다.
export async function sendKakaoTest(): Promise<KakaoActionResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };

  let outcome;
  try {
    outcome = await sendKakaoToUser(session.user.id, async ({ lang, siteUrl }) => {
      const { notify } = await getDictionary(lang);
      return {
        text: `${notify.testTitle}\n${notify.testBody}`,
        url: `${siteUrl}/${lang}/settings`,
        button: notify.openCalendar,
      };
    });
  } catch (e) {
    console.error("[kakao] sendKakaoTest failed:", e instanceof Error ? e.name : "error");
    return { ok: false, code: "failed" };
  }
  if (outcome.ok) return { ok: true };
  switch (outcome.code) {
    case "not_configured":
      return { ok: false, code: "notConfigured" };
    case "not_connected":
      return { ok: false, code: "notConnected" };
    case "reconnect_required":
      return { ok: false, code: "reconnect" };
    default:
      return { ok: false, code: "failed" };
  }
}
