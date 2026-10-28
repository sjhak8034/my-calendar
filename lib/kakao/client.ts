import "server-only";
import type { KakaoConfig } from "./config";

// 카카오 REST API 호출. 호출 대상은 아래 고정된 카카오 도메인뿐이다.
// 토큰·인가 코드·응답 본문은 로그에 남기지 않는다.
const AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const MEMO_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";
const UNLINK_URL = "https://kapi.kakao.com/v1/user/unlink";

// pg_net의 호출 제한(10초) 안에 워커가 끝나도록 요청마다 짧게 끊는다.
const TIMEOUT_MS = 5000;

export type KakaoFailure = {
  ok: false;
  // unauthorized: 토큰·인가 코드가 유효하지 않음(재연결 필요), forbidden: 동의 항목 없음 등, limit: 호출 한도
  reason: "unauthorized" | "forbidden" | "limit" | "rejected" | "server" | "network";
  status?: number;
  code?: number; // 카카오 오류 코드(예: -401, -3, -402)
};

export type KakaoTokens = {
  accessToken: string;
  expiresIn: number; // 초
  refreshToken?: string; // 갱신 응답에는 기존 리프레시 토큰의 남은 기간이 1개월 미만일 때만 있다.
  refreshExpiresIn?: number; // 초
  scope?: string; // 공백으로 구분
};

async function request(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    return null;
  }
}

function failure(response: Response | null): KakaoFailure {
  if (!response) return { ok: false, reason: "network" };
  const { status } = response;
  const reason =
    status === 401 ? "unauthorized" : status === 403 ? "forbidden" : status === 429 ? "limit" : status >= 500 ? "server" : "rejected";
  return { ok: false, reason, status };
}

// 인가 화면 주소. state는 CSRF 방어용으로 요청마다 새로 만든 값이어야 한다.
export function buildAuthorizeUrl(config: KakaoConfig, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.restApiKey,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "talk_message",
    state,
  }).toString();
  return url.toString();
}

function parseTokens(body: unknown): KakaoTokens | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.access_token !== "string" || typeof b.expires_in !== "number") return null;
  return {
    accessToken: b.access_token,
    expiresIn: b.expires_in,
    refreshToken: typeof b.refresh_token === "string" ? b.refresh_token : undefined,
    refreshExpiresIn: typeof b.refresh_token_expires_in === "number" ? b.refresh_token_expires_in : undefined,
    scope: typeof b.scope === "string" ? b.scope : undefined,
  };
}

async function requestTokens(
  config: KakaoConfig,
  params: Record<string, string>,
): Promise<{ ok: true; value: KakaoTokens } | KakaoFailure> {
  const body = new URLSearchParams({ client_id: config.restApiKey, ...params });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);
  const response = await request(TOKEN_URL, { method: "POST", body });
  if (!response) return failure(null);
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // 만료·철회된 인가 코드/리프레시 토큰은 400 + error=invalid_grant로 온다.
    const error = (json as { error?: unknown } | null)?.error;
    if (error === "invalid_grant") return { ok: false, reason: "unauthorized", status: response.status };
    return failure(response);
  }
  const tokens = parseTokens(json);
  return tokens ? { ok: true, value: tokens } : { ok: false, reason: "rejected", status: response.status };
}

// 인가 코드를 토큰으로 바꾼다(redirect_uri는 인가 요청 때와 같아야 한다).
export function exchangeCode(config: KakaoConfig, code: string) {
  return requestTokens(config, { grant_type: "authorization_code", redirect_uri: config.redirectUri, code });
}

export function refreshAccessToken(config: KakaoConfig, refreshToken: string) {
  return requestTokens(config, { grant_type: "refresh_token", refresh_token: refreshToken });
}

// "나에게 보내기". template은 카카오 메시지 템플릿 객체(예: object_type "text").
export async function sendMemo(
  accessToken: string,
  template: Record<string, unknown>,
): Promise<{ ok: true } | KakaoFailure> {
  const response = await request(MEMO_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  });
  if (!response) return failure(null);
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (json as { code?: unknown } | null)?.code;
    return typeof code === "number" ? { ...failure(response), code } : failure(response);
  }
  return (json as { result_code?: unknown } | null)?.result_code === 0
    ? { ok: true }
    : { ok: false, reason: "rejected", status: response.status };
}

// 연결 끊기: 동의를 철회하고 토큰을 폐기한다. 실패해도 호출한 쪽은 자기 쪽 데이터를 지우고 진행한다.
export async function unlink(accessToken: string): Promise<boolean> {
  const response = await request(UNLINK_URL, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
  return response?.ok === true;
}
