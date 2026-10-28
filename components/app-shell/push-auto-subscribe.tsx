import { Suspense } from "react";
import { PushAutoSubscribeClient } from "@/components/app-shell/push-auto-subscribe-client";
import { getCurrentUser } from "@/lib/supabase/current-user";

async function AutoSubscribe({ lang }: { lang: string }) {
  const { pushEnabled } = await getCurrentUser();
  return pushEnabled ? <PushAutoSubscribeClient lang={lang} /> : null;
}

// 웹 푸시를 켜 둔 계정이면 로그인 후 이 브라우저를 자동으로 다시 구독시킨다. 사용자 조회는 요청 시점 데이터라 Suspense 안에서 한다.
export function PushAutoSubscribe({ lang }: { lang: string }) {
  return (
    <Suspense fallback={null}>
      <AutoSubscribe lang={lang} />
    </Suspense>
  );
}
