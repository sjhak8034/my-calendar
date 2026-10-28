"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type ActionState } from "@/app/[lang]/login/actions";
import { AUTH_CARD_CLASS, AUTH_INPUT_CLASS } from "@/components/auth/auth-styles";
import { useCaptcha } from "@/components/auth/captcha";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const initialState: ActionState = {};

// 비밀번호 재설정 메일 요청. 링크가 만료돼 돌아온 경우(initialError)에는 안내를 먼저 보여 준다.
export function ForgotPasswordForm({
  lang,
  dict,
  login,
  initialError,
}: {
  lang: string;
  dict: Dictionary["forgotPassword"];
  login: Dictionary["login"];
  initialError?: string;
}) {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  // 토큰은 한 번만 쓸 수 있어서, 제출이 끝날 때마다 새로 받는다.
  const captcha = useCaptcha(lang);
  const { enabled: captchaEnabled, reset: resetCaptcha } = captcha;
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && captchaEnabled) resetCaptcha();
    wasPending.current = pending;
  }, [pending, captchaEnabled, resetCaptcha]);
  // 제출 중에는 이전 결과가 남아 보이지 않게 숨기고, 한 번이라도 제출했으면 초기 안내는 더 보이지 않는다.
  const submitted = state.error !== undefined || state.notice !== undefined;
  const error = pending ? undefined : submitted ? state.error : initialError;
  const notice = pending ? undefined : state.notice;

  return (
    <div className={AUTH_CARD_CLASS}>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{dict.title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-balance break-keep text-base text-foreground/80">
          {dict.description}
        </p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="captchaToken" value={captcha.token} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="sr-only">
            {login.emailLabel}
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email ?? ""}
            placeholder={login.emailPlaceholder}
            aria-invalid={error ? true : undefined}
            className={AUTH_INPUT_CLASS}
          />
        </div>
        {captcha.widget}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-center text-sm text-foreground/80">
            {notice}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending || !captcha.ready}
          className="h-12! w-full rounded-xl! text-base! font-semibold"
        >
          {pending ? login.pending : dict.button}
        </Button>
        {!captcha.ready && (
          <p role="status" className="text-center text-xs text-muted-foreground">
            {login.captchaChecking}
          </p>
        )}
      </form>
      <p className="text-center text-sm">
        <Link
          href={`/${lang}/login`}
          className="rounded-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {dict.back}
        </Link>
      </p>
    </div>
  );
}
