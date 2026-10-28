"use server";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import { sendKakaoToUser } from "@/lib/notify/kakao";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/require-user";
import { unlinkKakaoForUser } from "./unlink-user";

export type KakaoActionResult =
  | { ok: true }
  | {
      ok: false;
      code: "unauthorized" | "guest" | "notConfigured" | "notConnected" | "reconnect" | "rateLimited" | "failed";
    };

// 카카오 연결을 끊는다. 카카오 쪽(동의 철회·토큰 폐기)은 할 수 있으면 하고, 실패해도 우리 쪽 토큰은 지운다.
// Server Action은 직접 POST로도 호출되므로 로그인을 서버에서 확인하고 본인 행만 다룬다.
export async function disconnectKakao(): Promise<KakaoActionResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  const admin = createAdminClient();
  if (!admin) return { ok: false, code: "failed" };

  await unlinkKakaoForUser(session.user.id);

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
  // 게스트는 카카오톡을 연결할 수 없다(연결 라우트가 거부). 테스트 발송도 같은 기준으로 막는다.
  if (session.user.is_anonymous === true) return { ok: false, code: "guest" };

  // 카카오 API를 반복해서 부르지 못하게 사용자당 1분에 3번까지만 보낸다.
  const limit = await hitRateLimit(session.supabase, "kakao_test", 3, 60);
  if (limit === "limited") return { ok: false, code: "rateLimited" };
  if (limit === "error") return { ok: false, code: "failed" };

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
