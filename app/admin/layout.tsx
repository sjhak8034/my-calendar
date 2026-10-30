import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import "./admin-theme.css";

// 관리자 테마(modern-minimal)의 폰트. admin-theme.css가 --font-geist-* 변수를 이 두 변수로 연결한다.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

// 일반 앱(app/[lang])과 따로 두는 두 번째 루트 레이아웃. 언어 접두사·사이드바·환영 인트로가 없다.
// 관리자 화면은 한국어만 쓴다(사전 파일을 쓰지 않는다). 검색 엔진에는 알리지 않는다.
export const metadata: Metadata = {
  title: "관리자 | my-calendar",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    // admin-theme: 나중에 관리자 전용 테마(색·반경)를 이 클래스 범위에만 적용하기 위한 자리다.
    <html
      lang="ko"
      className={`${inter.variable} ${jetbrainsMono.variable} admin-theme h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="border-b bg-card">
          <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4">
            <span className="text-sm font-semibold tracking-tight">
              my-calendar <span className="text-muted-foreground">관리자</span>
            </span>
            {/* 일반 앱은 별도 루트 레이아웃이라 일반 링크(전체 새로 불러오기)로 이동한다. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              앱으로 돌아가기
            </a>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
