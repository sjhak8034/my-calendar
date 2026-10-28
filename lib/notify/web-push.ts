import "server-only";
import webpush from "web-push";
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n/config";
import { parsePushSubscription } from "@/lib/push/input";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DispatchResult, DueNotification } from "./dispatch";
import { notificationMessage } from "./message";

// 서비스 워커(public/sw.js)가 받는 페이로드
export type PushPayload = { title: string; body: string; url: string; tag: string };

export type PushSummary = {
  total: number; // 사용자의 구독 수
  sent: number;
  removed: number; // 만료·잘못된 구독이라 지운 수
  failed: number;
  error?: string; // 첫 실패 원인(http_403 등). 구독 주소는 비밀이라 남기지 않는다.
};

// 푸시 서비스가 못 보낸 알림을 들고 있는 시간. 시작 10분 전 알림이 한참 뒤에 도착하면 의미가 없다.
const TTL_SECONDS = 600;
// pg_net의 호출 제한(10초) 안에 워커가 끝나도록 구독당 요청은 짧게 끊는다.
const REQUEST_TIMEOUT_MS = 5000;

function vapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { subject, publicKey, privateKey } : null;
}

function statusOf(error: unknown): number | null {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" ? status : null;
}

// 사용자의 모든 구독(브라우저)에 푸시를 보낸다. 문구는 구독마다 저장된 언어로 만든다.
// 설정이 빠져 있으면 null. 구독 조회 실패는 던진다(워커가 failed로 기록한다).
export async function sendPushToUser(
  userId: string,
  build: (lang: Locale) => Promise<PushPayload>,
): Promise<PushSummary | null> {
  const vapid = vapidDetails();
  const admin = createAdminClient();
  if (!vapid || !admin) return null;

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys, lang")
    .eq("user_id", userId);
  if (error) throw new Error(`push_subscriptions query failed: ${error.message}`);

  const remove = async (id: string) => {
    const { error: deleteError } = await admin.from("push_subscriptions").delete().eq("id", id);
    if (deleteError) console.error("[push] remove subscription failed:", deleteError.message);
  };

  const results = await Promise.all(
    data.map(async (row): Promise<"sent" | "removed" | string> => {
      // 저장할 때 이미 검증하지만, 발송 직전에 호스트 허용 목록을 다시 확인한다(서버가 이 주소로 직접 요청을 보낸다).
      const subscription = parsePushSubscription({ endpoint: row.endpoint, keys: row.keys });
      if (!subscription) {
        await remove(row.id);
        return "removed";
      }
      const lang = hasLocale(row.lang) ? row.lang : defaultLocale;
      try {
        const payload = await build(lang);
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
          vapidDetails: vapid,
          TTL: TTL_SECONDS,
          urgency: "high",
          timeout: REQUEST_TIMEOUT_MS,
        });
        return "sent";
      } catch (e) {
        const status = statusOf(e);
        // 404·410: 브라우저가 구독을 해제했거나 만료됐다. 다시는 보낼 수 없으니 지운다.
        if (status === 404 || status === 410) {
          await remove(row.id);
          return "removed";
        }
        // 구독 주소(endpoint)는 비밀이라 메시지에 섞여 있을 수 있는 URL은 지우고 남긴다.
        const detail = e instanceof Error ? `${e.name} ${(e as { code?: string }).code ?? ""} ${e.message}` : "error";
        console.error("[push] send failed:", status ?? detail.replace(/https?:\/\/\S+/g, "<url>").slice(0, 200));
        return status ? `http_${status}` : "error";
      }
    }),
  );

  const failures = results.filter((r) => r !== "sent" && r !== "removed");
  return {
    total: data.length,
    sent: results.filter((r) => r === "sent").length,
    removed: results.filter((r) => r === "removed").length,
    failed: failures.length,
    error: failures[0],
  };
}

// 워커가 선점한 web_push 알림 한 건을 보낸다.
export async function dispatchWebPush(n: DueNotification): Promise<DispatchResult> {
  const summary = await sendPushToUser(n.user_id, (lang) => notificationMessage(n, lang));
  if (!summary) return { status: "failed", error: "push_not_configured" };
  if (summary.sent > 0) return { status: "sent" };
  if (summary.failed > 0) return { status: "failed", error: summary.error ?? "push_failed" };
  // 보낼 곳이 없었다: 구독이 없거나 전부 만료돼 지워졌다. 실패가 아니라 건너뜀이다.
  return { status: "skipped", error: summary.total === 0 ? "no_subscription" : "subscription_expired" };
}
