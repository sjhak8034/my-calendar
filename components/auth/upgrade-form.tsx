"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upgradeWithEmail, upgradeWithGoogle, type ActionState } from "@/app/[lang]/login/actions";
import { GoogleIcon } from "@/components/auth/google-icon";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Props = {
  lang: string;
  dict: Dictionary["upgrade"];
  // 이메일·비밀번호 라벨은 로그인 화면과 같은 문구를 쓴다.
  login: Dictionary["login"];
  // 연결 실패 후 /auth/callback이 되돌려 준 오류 메시지
  initialError?: string;
};

const initialState: ActionState = {};
const inputClass = "h-12! rounded-xl! bg-card! px-4! text-sm!";

// 게스트가 이메일 또는 Google 계정을 연결해 정식 계정으로 전환하는 폼
export function UpgradeForm({ lang, dict, login, initialError }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [source, setSource] = useState<"initial" | "email" | "google">("initial");
  const [emailState, emailAction, emailPending] = useActionState(upgradeWithEmail, initialState);
  const [googleState, googleAction, googlePending] = useActionState(upgradeWithGoogle, initialState);

  const busy = emailPending || googlePending;
  const error = busy
    ? undefined
    : source === "email"
      ? emailState.error
      : source === "google"
        ? googleState.error
        : initialError;
  const notice = !busy && source === "email" ? emailState.notice : undefined;

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      <form action={emailAction} onSubmit={() => setSource("email")} className="flex flex-col gap-4">
        <input type="hidden" name="lang" value={lang} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="upgrade-email" className="sr-only">
            {login.emailLabel}
          </Label>
          <Input
            id="upgrade-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={emailState.email ?? ""}
            placeholder={login.emailPlaceholder}
            className={inputClass}
          />
        </div>
        <div className="relative">
          <Label htmlFor="upgrade-password" className="sr-only">
            {login.passwordLabel}
          </Label>
          <Input
            id="upgrade-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder={login.passwordPlaceholder}
            className={`${inputClass} pr-12!`}
          />
          <button
            type="button"
            aria-label={showPassword ? login.hidePassword : login.showPassword}
            aria-controls="upgrade-password"
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
        <Button type="submit" disabled={busy} className="h-12! w-full rounded-xl! text-base! font-semibold">
          {emailPending ? dict.pending : dict.emailButton}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-3 text-sm">
        <span aria-hidden="true" className="h-px w-3 bg-foreground" />
        <span>{dict.or}</span>
        <span aria-hidden="true" className="h-px w-3 bg-foreground" />
      </div>

      <form action={googleAction} onSubmit={() => setSource("google")}>
        <input type="hidden" name="lang" value={lang} />
        <Button
          type="submit"
          variant="outline"
          disabled={busy}
          className="h-12! w-full rounded-xl! gap-2.5! text-sm! font-semibold"
        >
          <GoogleIcon className="size-5" />
          {googlePending ? dict.pending : dict.googleButton}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <Link
        href={`/${lang}`}
        className="self-center rounded-sm text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {dict.back}
      </Link>
    </div>
  );
}
