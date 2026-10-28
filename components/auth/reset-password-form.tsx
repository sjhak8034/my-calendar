"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type ActionState } from "@/app/[lang]/login/actions";
import { AUTH_CARD_CLASS, AUTH_INPUT_CLASS } from "@/components/auth/auth-styles";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const initialState: ActionState = {};

// 재설정 메일의 링크로 들어온 사용자가 새 비밀번호를 정한다. 성공하면 서버 액션이 캘린더로 이동시킨다.
export function ResetPasswordForm({
  lang,
  dict,
  login,
}: {
  lang: string;
  dict: Dictionary["resetPassword"];
  login: Dictionary["login"];
}) {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  const error = pending ? undefined : state.error;

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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="sr-only">
            {dict.passwordLabel}
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder={dict.passwordLabel}
            aria-invalid={error ? true : undefined}
            className={AUTH_INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm" className="sr-only">
            {dict.confirmLabel}
          </Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder={dict.confirmLabel}
            aria-invalid={error ? true : undefined}
            className={AUTH_INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-muted-foreground">{login.passwordHint}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-12! w-full rounded-xl! text-base! font-semibold">
          {pending ? login.pending : dict.button}
        </Button>
      </form>
    </div>
  );
}
