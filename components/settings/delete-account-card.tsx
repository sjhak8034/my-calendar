"use client";

import { useState } from "react";
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

// 계정 삭제. 되돌릴 수 없어서 대화상자에서 가입한 이메일을 직접 입력해야 삭제 버튼이 켜진다(서버도 다시 확인한다).
export function DeleteAccountCard({
  lang,
  email,
  dict,
}: {
  lang: string;
  email: string;
  dict: Dictionary["settings"]["account"];
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeOpen(next: boolean) {
    if (pending) return; // 삭제하는 동안에는 닫지 않는다.
    setOpen(next);
    setTyped("");
    setError(null);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      // 브라우저의 푸시 구독은 로그인이 살아 있는 동안에만 서버 행까지 정리할 수 있어 먼저 해제한다.
      await releasePushSubscription();
      // 성공하면 서버가 로그인 화면으로 이동시키므로 여기로 돌아오는 것은 실패뿐이다.
      const result = await deleteAccount(typed, lang);
      if (result && !result.ok) {
        setError(
          result.code === "mismatch"
            ? dict.errors.mismatch
            : result.code === "unauthorized"
              ? dict.errors.unauthorized
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
            <DialogDescription>{dict.dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-account-email">{dict.emailLabel}</Label>
            <p className="break-all text-sm font-medium">{email}</p>
            <Input
              id="delete-account-email"
              type="email"
              autoComplete="off"
              value={typed}
              disabled={pending}
              onChange={(event) => setTyped(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
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
              disabled={pending || !emailMatches(typed, email)}
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
