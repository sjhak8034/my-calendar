import type { NextConfig } from "next";

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
  // 서비스 워커는 브라우저가 캐시하면 갱신이 늦어지므로 항상 다시 확인하게 하고, 이 범위(전체 사이트)에서만 동작하도록 고정한다.
  async headers() {
    return [
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
