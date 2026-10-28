import type { MetadataRoute } from "next";

// 홈 화면에 설치(iOS 16.4+ 웹 푸시의 전제 조건 포함)할 때 쓰는 웹 앱 매니페스트.
// 색은 globals.css의 --background와 로고 파랑에 맞췄다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "my-calendar",
    short_name: "my-calendar",
    description: "AI 대화와 알림이 있는 캘린더",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f2e9",
    theme_color: "#2a73ff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
