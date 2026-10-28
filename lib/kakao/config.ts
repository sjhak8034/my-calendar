import "server-only";

export type KakaoConfig = {
  restApiKey: string;
  clientSecret?: string; // 카카오 REST API 키는 기본으로 Client Secret이 켜져 있어 보통 필요하다.
  siteUrl: string;
  redirectUri: string;
  encryptionKey: Buffer; // 토큰 암호화용 32바이트
};

// 카카오 연동에 필요한 환경변수가 모두 올바르면 설정을, 하나라도 빠졌거나 형식이 틀리면 null을 돌려준다.
export function kakaoConfig(): KakaoConfig | null {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || undefined;
  const siteUrl = process.env.SITE_URL?.replace(/\/+$/, "");
  const encryptionKey = Buffer.from(process.env.KAKAO_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (!restApiKey || !siteUrl || encryptionKey.length !== 32) return null;
  // Redirect URI와 메시지 링크를 만드는 기준이라 경로 없는 origin이어야 한다.
  try {
    if (new URL(siteUrl).origin !== siteUrl) return null;
  } catch {
    return null;
  }
  return { restApiKey, clientSecret, siteUrl, redirectUri: `${siteUrl}/auth/kakao/callback`, encryptionKey };
}
