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
