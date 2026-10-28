// 클라이언트 컴포넌트도 쓰는 카카오 연결 타입. server-only 모듈이 아니다.

// 설정 화면의 카카오 연결 상태
export type KakaoStatus = "not_configured" | "disconnected" | "connected" | "reconnect_required";

// 연결 OAuth가 끝나고 /[lang]/settings?kakao=... 로 돌려보낼 때 쓰는 결과 코드
export const CONNECT_RESULTS = ["connected", "denied", "failed", "notConfigured", "origin"] as const;
export type ConnectResult = (typeof CONNECT_RESULTS)[number];

export function isConnectResult(value: unknown): value is ConnectResult {
  return typeof value === "string" && (CONNECT_RESULTS as readonly string[]).includes(value);
}
