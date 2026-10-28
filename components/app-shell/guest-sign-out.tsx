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
import { SignOutForm } from "@/components/app-shell/sign-out-form";

type Props = {
  lang: string;
  labels: {
    signOut: string;
    title: string;
    description: string;
    cancel: string;
  };
};

// 게스트는 로그아웃하면 데이터를 되찾을 수 없으므로 한 번 더 확인한다.
export function GuestSignOut({ lang, labels }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        {labels.signOut}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <SignOutForm lang={lang}>
              <Button type="submit" variant="destructive">
                {labels.signOut}
              </Button>
            </SignOutForm>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
