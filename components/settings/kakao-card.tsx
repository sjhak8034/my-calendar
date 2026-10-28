"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { disconnectKakao, sendKakaoTest, type KakaoActionResult } from "@/lib/kakao/actions";
import type { ConnectResult, KakaoStatus } from "@/lib/kakao/types";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Busy = "test" | "disconnect" | null;

// 카카오톡 알림 연결 상태와 연결·해제·테스트 메시지. 연결은 카카오 동의 화면으로 이동하는 일반 링크(<a>)다.
// Link를 쓰면 미리 가져오기가 /auth/kakao/connect를 호출해 state 쿠키가 불필요하게 만들어진다.
export function KakaoCard({
  lang,
  dict,
  status,
  result,
}: {
  lang: string;
  dict: Dictionary["settings"]["kakao"];
  status: KakaoStatus;
  result: ConnectResult | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "ok" | "error" } | null>(
    result ? { text: dict.results[result], tone: result === "connected" ? "ok" : "error" } : null,
  );

  // 연결 결과를 한 번 보여 준 뒤 주소에서 ?kakao=를 지운다(새로고침해도 같은 안내가 다시 뜨지 않게).
  useEffect(() => {
    if (result) router.replace(`/${lang}/settings`, { scroll: false });
  }, [result, lang, router]);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<KakaoActionResult>, okText?: string) {
    setBusy(kind);
    setBanner(null);
    try {
      const outcome = await action();
      if (outcome.ok) {
        if (okText) setBanner({ text: okText, tone: "ok" });
      } else {
        const text =
          outcome.code === "notConnected"
            ? dict.errors.notConnected
            : outcome.code === "reconnect"
              ? dict.errors.reconnect
              : outcome.code === "notConfigured"
                ? dict.notConfigured
                : dict.errors.failed;
        setBanner({ text, tone: "error" });
      }
      // 상태(연결됨·재연결 필요)가 바뀌었을 수 있어 서버 데이터를 다시 가져온다.
      router.refresh();
    } catch {
      setBanner({ text: dict.errors.failed, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const statusText = busy
    ? dict.working
    : status === "connected"
      ? dict.connected
      : status === "reconnect_required"
        ? dict.reconnectNeeded
        : status === "not_configured"
          ? dict.notConfigured
          : dict.disconnected;
  const connectHref = `/auth/kakao/connect?lang=${lang}`;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{dict.title}</h2>
        <p className="text-sm text-muted-foreground">{dict.description}</p>
      </div>
      <p
        role="status"
        className={status === "reconnect_required" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
      >
        {statusText}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {(status === "disconnected" || status === "reconnect_required") && (
          <a href={connectHref} className={buttonVariants({ size: "sm" })}>
            {status === "reconnect_required" ? dict.reconnect : dict.connect}
          </a>
        )}
        {status === "connected" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void run("test", sendKakaoTest, dict.testSent)}
          >
            {dict.test}
          </Button>
        )}
        {(status === "connected" || status === "reconnect_required") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => void run("disconnect", disconnectKakao)}
          >
            {dict.disconnect}
          </Button>
        )}
      </div>
      {banner && (
        <p
          role={banner.tone === "error" ? "alert" : "status"}
          className={banner.tone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {banner.text}
        </p>
      )}
    </section>
  );
}
