"use client";

import { useEffect, useRef, useState } from "react";
import { useCaptcha } from "@/components/auth/captcha";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "@/lib/account/actions";
import { emailMatches } from "@/lib/account/confirm";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { releasePushSubscription } from "@/lib/push/client";

// 계정 삭제. 되돌릴 수 없어서 대화상자에서 비밀번호(Google로만 가입했다면 가입한 이메일)를 입력해야 삭제 버튼이 켜진다.
// 비밀번호는 서버가 Supabase로 확인한다(화면에서는 비어 있지 않은지만 본다).
export function DeleteAccountCard({
  lang,
  email,
  usesPassword,
  dict,
}: {
  lang: string;
  email: string;
  // 비밀번호로 로그인하는 계정이면 비밀번호로, Google로만 가입한 계정이면 이메일 입력으로 확인한다.
  usesPassword: boolean;
  dict: Dictionary["settings"]["account"];
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 비밀번호 확인은 로그인과 같은 Supabase 검사라 CAPTCHA 토큰이 필요하다(토큰은 한 번만 쓸 수 있어 시도가 끝나면 새로 받는다).
  const captcha = useCaptcha(lang);
  const { enabled: captchaEnabled, reset: resetCaptcha } = captcha;
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && usesPassword && captchaEnabled) resetCaptcha();
    wasPending.current = pending;
  }, [pending, usesPassword, captchaEnabled, resetCaptcha]);
  const canSubmit = usesPassword ? typed.length > 0 && captcha.ready : emailMatches(typed, email);

  function changeOpen(next: boolean) {
    if (pending) return; // 삭제하는 동안에는 닫지 않는다.
    setOpen(next);
    setTyped("");
    setError(null);
    // 대화상자를 닫으면 위젯이 사라지므로, 남은 토큰으로 제출되지 않게 비우고 다시 열 때 새로 받는다.
    if (usesPassword && captchaEnabled) resetCaptcha();
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      // 브라우저의 푸시 구독은 로그인이 살아 있는 동안에만 서버 행까지 정리할 수 있어 먼저 해제한다.
      await releasePushSubscription();
      // 성공하면 서버가 로그인 화면으로 이동시키므로 여기로 돌아오는 것은 실패뿐이다.
      const result = await deleteAccount(typed, lang, usesPassword ? captcha.token : undefined);
      if (result && !result.ok) {
        setError(
          result.code === "mismatch"
            ? usesPassword
              ? dict.errors.mismatchPassword
              : dict.errors.mismatch
            : result.code === "unauthorized"
              ? dict.errors.unauthorized
              : result.code === "captcha"
                ? dict.errors.captchaFailed
                : result.code === "rateLimited"
                  ? dict.errors.rateLimited
                  : dict.errors.failed,
        );
      }
    } catch {
      setError(dict.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{dict.title}</h2>
        <p className="text-sm text-muted-foreground">{dict.description}</p>
      </div>
      <div>
        <Button type="button" variant="destructive" size="sm" onClick={() => changeOpen(true)}>
          {dict.button}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.dialogTitle}</DialogTitle>
            <DialogDescription>{usesPassword ? dict.dialogDescriptionPassword : dict.dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {usesPassword ? (
              <Label htmlFor="delete-account-confirm">{dict.passwordLabel}</Label>
            ) : (
              <>
                <Label htmlFor="delete-account-confirm">{dict.emailLabel}</Label>
                <p className="break-all text-sm font-medium">{email}</p>
              </>
            )}
            <Input
              id="delete-account-confirm"
              type={usesPassword ? "password" : "email"}
              autoComplete={usesPassword ? "current-password" : "off"}
              value={typed}
              disabled={pending}
              onChange={(event) => setTyped(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
            {usesPassword && captcha.widget}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>
              {dict.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !canSubmit}
              onClick={() => void confirm()}
            >
              {pending ? dict.deleting : dict.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
