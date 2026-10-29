import type { NextConfig } from "next";

// 모든 응답에 붙는 기본 보안 헤더. CSP는 Next.js의 인라인 스크립트·서비스 워커·푸시와 맞추는 시험이 필요해 후속으로 미뤘다.
const securityHeaders = [
  // 브라우저가 응답 형식을 추측해 스크립트로 실행하지 않게 한다.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 다른 사이트로 이동할 때 경로·검색어를 넘기지 않는다(같은 사이트 안에서는 전체 주소).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 다른 사이트가 이 앱을 iframe에 끼워 클릭을 가로채지 못하게 한다.
  { key: "X-Frame-Options", value: "DENY" },
  // HTTPS로만 접속하게 한다(로컬 HTTP에서는 무시된다). preload는 되돌리기 어려워 넣지 않는다.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // 쓰지 않는 기기 기능을 막는다. 알림(푸시)은 이 정책의 대상이 아니다. 위치는 날씨 표시에만 우리 화면에서 쓰므로 (self)만 허용한다(다른 사이트가 넣은 프레임은 못 쓴다).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // 개발 서버는 기본으로 localhost만 허용한다. 127.0.0.1로 접속하면 HMR 연결이 막혀 화면이 하이드레이션되지 않고
  // 버튼이 동작하지 않으므로 함께 허용한다(개발 전용 설정, 프로덕션에는 영향 없음).
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  // 개발 서버가 서버 액션의 인자를 터미널에 그대로 찍는 것을 끈다(로그인·비밀번호 폼의 값이나 푸시 구독 키가 로그에 남지 않게).
  // 요청 로그(POST /ko/login 200 in ...)는 그대로 나온다. 운영 빌드에는 이 로그가 없다.
  logging: { serverFunctions: false },
  // 서비스 워커는 브라우저가 캐시하면 갱신이 늦어지므로 항상 다시 확인하게 하고, 이 범위(전체 사이트)에서만 동작하도록 고정한다.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
