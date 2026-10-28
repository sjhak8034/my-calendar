"use client";

import { useEffect } from "react";
import { subscribeThisBrowser, supportsPush } from "@/lib/push/client";

// 이 계정이 웹 푸시를 켜 둔 상태인데 이 브라우저에 구독이 없으면(로그아웃으로 해제됐거나 새로 로그인한 경우) 다시 구독한다.
// 알림 권한을 이미 허용한 브라우저에서만 조용히 동작하고, 권한 창은 절대 띄우지 않는다.
export function PushAutoSubscribeClient({ lang }: { lang: string }) {
  useEffect(() => {
    if (!supportsPush() || Notification.permission !== "granted") return;
    // 실패해도 화면에는 영향이 없다. 설정 화면에서 직접 켤 수 있다.
    void subscribeThisBrowser(lang).catch(() => {});
  }, [lang]);
  return null;
}
