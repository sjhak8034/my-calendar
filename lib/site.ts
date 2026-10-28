const FALLBACK = "http://localhost:3000";

// 이 앱의 공개 주소(origin). 메타데이터·sitemap·robots에 쓴다. 환경변수 SITE_URL이 없거나 올바르지 않으면 로컬 주소를 쓴다.
export function siteUrl(): string {
  const raw = process.env.SITE_URL?.replace(/\/+$/, "");
  if (!raw) return FALLBACK;
  try {
    return new URL(raw).origin;
  } catch {
    return FALLBACK;
  }
}

// 개인정보 보호책임자 연락처. 개인정보처리방침에 표시된다.
export const PRIVACY_CONTACT_EMAIL = "thdwjdgkr123@gmail.com";
