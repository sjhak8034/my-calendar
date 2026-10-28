"use client";

import type { ReactNode } from "react";
import { signOut } from "@/app/[lang]/login/actions";
import { releasePushSubscription } from "@/lib/push/client";

// 로그아웃 폼. 로그아웃 전에 이 브라우저의 웹 푸시 구독을 해제해, 공유 기기에서 이전 사용자의 알림이 계속 뜨지 않게 한다.
// 서버 쪽 구독 삭제는 로그인이 필요해서 반드시 signOut보다 먼저 해야 한다.
export function SignOutForm({ lang, children }: { lang: string; children: ReactNode }) {
  async function action(formData: FormData) {
    await releasePushSubscription();
    await signOut(formData);
  }
  return (
    <form action={action}>
      <input type="hidden" name="lang" value={lang} />
      {children}
    </form>
  );
}
