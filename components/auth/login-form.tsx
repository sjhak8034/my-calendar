"use client";

import { useActionState, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInAsGuest,
  signInWithGoogle,
  signInWithPassword,
  signUp,
  type ActionState,
} from "@/app/[lang]/login/actions";
import { GoogleIcon } from "@/components/auth/google-icon";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Props = {
  lang: string;
  // 서버에서 받은 사전 일부
  dict: Dictionary["login"];
  // 처음 보여 줄 모드(상단 바의 회원가입 링크 등)
  initialMode?: "signIn" | "signUp";
  // /auth/callback 실패 등으로 전달된 초기 오류 메시지
  initialError?: string;
};

const initialState: ActionState = {};

// 화면에 보여 줄 오류의 출처. 가장 최근 액션(또는 초기 오류)만 표시한다.
type ErrorSource = "initial" | "password" | "google" | "guest" | "none";

// 시안의 둥근 입력창. cn이 충돌 클래스를 병합하지 않으므로 ! 로 기본값을 덮어쓴다.
const inputClass = "h-12! rounded-xl! bg-card! px-4! text-sm!";

export function LoginForm({
  lang,
  dict,
  initialMode = "signIn",
  initialError,
}: Props) {
  const [mode, setMode] = useState<"signIn" | "signUp">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [errorSource, setErrorSource] = useState<ErrorSource>("initial");

  // 로그인 직후 인트로의 손글씨 이미지를 미리 받아 브라우저 캐시에 둔다(인트로가 뜨자마자 쓰기 시작하도록).
  // <link rel="preload">는 이 화면에서 쓰이지 않아 브라우저 경고가 나므로 이미지를 직접 불러 둔다.
  useEffect(() => {
    new Image().src = "/Welcome.svg";
  }, []);

  const [passwordState, passwordAction, passwordPending] = useActionState(
    mode === "signIn" ? signInWithPassword : signUp,
    initialState,
  );
  const [googleState, googleAction, googlePending] = useActionState(
    signInWithGoogle,
    initialState,
  );

  const [guestState, guestAction, guestPending] = useActionState(
    signInAsGuest,
    initialState,
  );

  const isSignIn = mode === "signIn";
  const busy = passwordPending || googlePending || guestPending;
  // 제출 중에는 이전 결과가 남아 보이지 않도록 숨긴다.
  const error = busy
    ? undefined
    : errorSource === "password"
      ? passwordState.error
      : errorSource === "google"
        ? googleState.error
        : errorSource === "guest"
          ? guestState.error
          : errorSource === "initial"
            ? initialError
            : undefined;
  // 가입 후 확인 메일을 보낸 경우의 안내(오류가 아니다)
  const notice = !busy && errorSource === "password" ? passwordState.notice : undefined;
  // 입력과 관련된 오류(Google 실패 제외)만 입력에 연결한다.
  const inputError = errorSource === "password" ? error : undefined;

  return (
    <div className="flex w-full max-w-[38rem] flex-col gap-6 rounded-[2rem] bg-card p-6 text-card-foreground shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--foreground)_18%,transparent)] dark:shadow-[0_24px_60px_-20px_color-mix(in_oklab,black_50%,transparent)] sm:p-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {isSignIn ? dict.signInTitle : dict.signUpTitle}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-balance break-keep text-base text-foreground/80">
          {isSignIn ? dict.signInDescription : dict.signUpDescription}
        </p>
      </div>

      <form
        action={passwordAction}
        onSubmit={() => setErrorSource("password")}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="lang" value={lang} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="sr-only">
            {dict.emailLabel}
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={passwordState.email ?? ""}
            placeholder={dict.emailPlaceholder}
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? "form-error" : undefined}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="sr-only">
            {dict.passwordLabel}
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignIn ? "current-password" : "new-password"}
              required
              placeholder={dict.passwordPlaceholder}
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? "form-error" : undefined}
              className={`${inputClass} pr-12!`}
            />
            <button
              type="button"
              aria-label={showPassword ? dict.hidePassword : dict.showPassword}
              aria-controls="password"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-foreground/70 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {showPassword ? (
                <EyeOff className="size-5" aria-hidden="true" />
              ) : (
                <Eye className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        {/* 비어 있을 때는 음수 마진으로 gap을 상쇄해 입력창-버튼 간격을 16px로 유지 */}
        <p
          id="form-error"
          role="alert"
          className="text-sm text-destructive empty:-my-2"
        >
          {error}
        </p>
        {notice && (
          <p role="status" className="text-center text-sm text-foreground/80">
            {notice}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy}
          className="h-12! w-full rounded-xl! text-base! font-semibold"
        >
          {passwordPending
            ? dict.pending
            : isSignIn
              ? dict.signInButton
              : dict.signUpButton}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-3 text-sm">
        <span aria-hidden="true" className="h-px w-3 bg-foreground" />
        <span>{isSignIn ? dict.orSignInWith : dict.orContinueWith}</span>
        <span aria-hidden="true" className="h-px w-3 bg-foreground" />
      </div>

      <form action={googleAction} onSubmit={() => setErrorSource("google")}>
        <input type="hidden" name="lang" value={lang} />
        <Button
          type="submit"
          variant="outline"
          className="h-12! w-full rounded-xl! gap-2.5! text-sm! font-semibold"
          disabled={busy}
        >
          <GoogleIcon className="size-5" />
          {dict.googleButton}
        </Button>
      </form>

      <form
        action={guestAction}
        onSubmit={() => setErrorSource("guest")}
        className="flex flex-col items-center gap-2"
      >
        <input type="hidden" name="lang" value={lang} />
        <Button
          type="submit"
          variant="ghost"
          className="h-12! w-full rounded-xl! text-sm! font-semibold"
          disabled={busy}
        >
          {guestPending ? dict.pending : dict.guestButton}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{dict.guestHint}</p>
      </form>

      <p className="text-center text-sm">
        {isSignIn ? dict.noAccount : dict.haveAccount}{" "}
        <button
          type="button"
          className="rounded-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => {
            setMode(isSignIn ? "signUp" : "signIn");
            setErrorSource("none");
          }}
        >
          {isSignIn ? dict.switchToSignUp : dict.switchToSignIn}
        </button>
      </p>
    </div>
  );
}
