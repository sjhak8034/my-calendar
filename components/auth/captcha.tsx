"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Cloudflare Turnstile(CAPTCHA). Supabase Auth가 서버에서 토큰을 검증한다(대시보드 Authentication > Attack Protection).
// NEXT_PUBLIC_TURNSTILE_SITE_KEY가 없으면 위젯을 띄우지 않고 토큰도 보내지 않는다(대시보드의 CAPTCHA도 꺼 둔 개발 환경).
// 공개 사이트 키만 브라우저에 있고, 비밀 키는 Supabase 대시보드에만 둔다.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

// Cloudflare 스크립트를 한 번만 불러온다. 실패하면 다음 시도에서 다시 불러온다.
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile load failed"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

function TurnstileWidget({
  siteKey,
  lang,
  onToken,
  resetSignal,
}: {
  siteKey: string;
  lang: string;
  onToken: (token: string | null) => void;
  resetSignal: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          language: lang,
          theme: "auto",
          // 항상 보이게 한다(확인 중 → 성공 표시). 사용자가 직접 누르는 확인은 Cloudflare가 의심스럽다고 판단할 때만 나타난다.
          // 평소에는 보이지 않게 하려면 "interaction-only".
          appearance: "always",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [siteKey, lang]);

  // 토큰은 한 번만 쓸 수 있어서, 제출이 끝나면 새 토큰을 받는다.
  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
  }, [resetSignal]);

  return <div ref={containerRef} className="flex min-h-[65px] justify-center" />;
}

export type Captcha = {
  enabled: boolean;
  // 토큰이 준비됐거나 CAPTCHA를 쓰지 않는 환경이면 true. 제출 버튼을 켜는 기준이다.
  ready: boolean;
  // 폼의 hidden 입력(captchaToken)에 넣을 값. 서버 액션이 Supabase에 그대로 전달한다.
  token: string;
  widget: ReactNode;
  // 제출 결과가 돌아온 뒤 새 토큰을 받는다.
  reset: () => void;
};

export function useCaptcha(lang: string): Captcha {
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const reset = useCallback(() => {
    setToken(null);
    setResetSignal((n) => n + 1);
  }, []);

  if (!SITE_KEY) return { enabled: false, ready: true, token: "", widget: null, reset };
  return {
    enabled: true,
    ready: token !== null,
    token: token ?? "",
    widget: <TurnstileWidget siteKey={SITE_KEY} lang={lang} onToken={setToken} resetSignal={resetSignal} />,
    reset,
  };
}
