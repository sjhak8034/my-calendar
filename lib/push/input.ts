// 웹 푸시 구독 입력 검증(Task 011). 순수 함수만 둔다.

// 사용자당 구독(브라우저·기기) 수 상한
export const PUSH_MAX_SUBSCRIPTIONS = 10;

const ENDPOINT_MAX = 2048;

// 서버가 이 주소로 직접 요청을 보내므로(SSRF 방지) 브라우저 벤더의 푸시 서비스만 허용한다.
// Chrome·Edge·Brave 등(FCM), Firefox(Mozilla autopush), Edge/Windows(WNS), Safari(Apple).
const ALLOWED_HOSTS = ["fcm.googleapis.com"];
const ALLOWED_HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

// PushSubscription.toJSON()의 키는 패딩 없는 base64url이다: p256dh는 65바이트(87자), auth는 16바이트(22자).
const P256DH_PATTERN = /^[A-Za-z0-9_-]{87}$/;
const AUTH_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function isAllowedEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname;
  return ALLOWED_HOSTS.includes(host) || ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

// 브라우저가 준 구독 객체(PushSubscription.toJSON())를 검증한다. 통과하면 필요한 값만 새 객체로 돌려준다.
export function parsePushSubscription(input: unknown): PushSubscriptionInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || endpoint.length > ENDPOINT_MAX || !isAllowedEndpoint(endpoint)) return null;
  if (typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (typeof p256dh !== "string" || !P256DH_PATTERN.test(p256dh)) return null;
  if (typeof auth !== "string" || !AUTH_PATTERN.test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

// 구독 해제용: 본인 행을 endpoint로 찾아 지우기만 하므로 호스트 허용 목록은 보지 않고 형식과 길이만 확인한다.
export function parsePushEndpoint(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0 || input.length > ENDPOINT_MAX) return null;
  return input;
}
