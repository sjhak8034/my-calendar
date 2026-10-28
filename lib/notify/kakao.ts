import "server-only";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { sendMemo } from "@/lib/kakao/client";
import { kakaoConfig } from "@/lib/kakao/config";
import { getAccessToken, markReconnectRequired } from "@/lib/kakao/tokens";
import type { DispatchResult, DueNotification } from "./dispatch";
import { notificationMessage } from "./message";

// 카카오 "나에게 보내기" 텍스트 템플릿의 글자 수 상한(문서에서 확인하지 못해 알려진 값 200자에 맞춘다).
const TEXT_MAX = 200;

// 동의가 취소됐거나 필요한 동의 항목이 없을 때 오는 카카오 오류 코드(-3: talk_message 미설정, -402: 동의 항목 부족).
// 한도 초과 등 같은 403이라도 다시 연결해서 풀리는 문제가 아니므로 이 코드일 때만 재연결로 본다.
const CONSENT_CODES = [-3, -402];

export type KakaoMessage = { text: string; url: string; button: string };

export type KakaoOutcome =
  | { ok: true }
  | {
      ok: false;
      code: "not_configured" | "not_connected" | "reconnect_required" | "refresh_failed" | "send_failed";
      detail?: string; // send_failed일 때 원인(예: server_503). 토큰·주소는 담지 않는다.
    };

function template(message: KakaoMessage) {
  return {
    object_type: "text",
    text: message.text.slice(0, TEXT_MAX),
    link: { web_url: message.url, mobile_web_url: message.url },
    button_title: message.button,
  };
}

// 사용자의 나와의 채팅으로 보낸다. 액세스 토큰이 거부되면 한 번 갱신해 다시 보낸다.
// 토큰이 끝내 거부되거나 동의가 취소된 것이면 재연결 필요로 표시한다.
// 저장된 토큰을 읽지 못하면 던진다(워커가 failed로 기록한다).
export async function sendKakaoToUser(
  userId: string,
  build: (context: { lang: Locale; siteUrl: string }) => Promise<KakaoMessage>,
): Promise<KakaoOutcome> {
  const config = kakaoConfig();
  if (!config) return { ok: false, code: "not_configured" };

  let token = await getAccessToken(userId);
  if (!token.ok) return { ok: false, code: token.reason };

  const body = template(await build({ lang: token.lang, siteUrl: config.siteUrl }));
  let result = await sendMemo(token.accessToken, body);
  if (!result.ok && result.reason === "unauthorized") {
    // 만료 시각 전에 토큰이 무효가 됐을 수 있다(재발급·철회). 갱신해서 한 번만 더 보낸다.
    token = await getAccessToken(userId, { forceRefresh: true });
    if (!token.ok) return { ok: false, code: token.reason };
    result = await sendMemo(token.accessToken, body);
  }
  if (result.ok) return { ok: true };

  if (result.reason === "unauthorized" || (result.code !== undefined && CONSENT_CODES.includes(result.code))) {
    await markReconnectRequired(userId);
    return { ok: false, code: "reconnect_required" };
  }
  console.error("[kakao] send failed:", result.reason, result.status ?? "", result.code ?? "");
  const detail = [result.reason, result.status, result.code].filter((part) => part !== undefined).join("_");
  return { ok: false, code: "send_failed", detail };
}

// 워커가 선점한 kakao 알림 한 건을 보낸다.
export async function dispatchKakao(n: DueNotification): Promise<DispatchResult> {
  const outcome = await sendKakaoToUser(n.user_id, async ({ lang, siteUrl }) => {
    const message = await notificationMessage(n, lang);
    const { notify } = await getDictionary(lang);
    return { text: `${message.title}\n${message.body}`, url: `${siteUrl}${message.url}`, button: notify.openCalendar };
  });
  if (outcome.ok) return { status: "sent" };
  switch (outcome.code) {
    // 카카오를 쓰지 않는 사용자·환경이라 보낼 곳이 없다. 실패가 아니다.
    case "not_configured":
      return { status: "skipped", error: "kakao_not_configured" };
    case "not_connected":
      return { status: "skipped", error: "not_connected" };
    // 사용자가 다시 연결해야 보낼 수 있다. 놓친 알림이라 실패로 남긴다.
    case "reconnect_required":
      return { status: "failed", error: "reconnect_required" };
    case "refresh_failed":
      return { status: "failed", error: "kakao_refresh_failed" };
    case "send_failed":
      return { status: "failed", error: `kakao_${outcome.detail ?? "send_failed"}` };
  }
}
