"use client";

import { errorMessages } from "@/lib/i18n/error-messages";

// 루트 레이아웃까지 실패했을 때의 마지막 화면. 레이아웃·스타일·언어를 알 수 없어서 두 언어를 함께 보여 주고 인라인 스타일만 쓴다.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { ko, en } = errorMessages;
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f5f2e9",
          color: "#2b2620",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>
            {ko.errorTitle} / {en.errorTitle}
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.8 }}>
            {ko.errorDescription}
            <br />
            {en.errorDescription}
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 16px", fontSize: 12, opacity: 0.7 }}>
              {ko.errorCode} / {en.errorCode}: <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{ padding: "10px 18px", fontSize: 15, borderRadius: 10, border: 0, background: "#2a73ff", color: "#fff", cursor: "pointer" }}
          >
            {ko.retry} / {en.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
