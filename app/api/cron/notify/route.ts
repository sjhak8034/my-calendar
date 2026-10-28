import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification, type DueNotification } from "@/lib/notify/dispatch";

const BASE_HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const CLAIM_LIMIT = 50;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: BASE_HEADERS });
}

// 공유 비밀(Authorization: Bearer <CRON_SECRET>) 검증. 길이가 달라도 같은 시간에 거부한다.
function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// POST /api/cron/notify: Supabase pg_cron(pg_net)이 1분마다 호출한다.
// 보낼 시각이 된 알림을 DB 함수로 원자적으로 선점(중복 발송 방지)하고 채널별로 보낸 뒤 결과를 기록한다.
// 로그인 쿠키가 아니라 공유 비밀로 인증하므로 proxy.ts가 /api/cron/* 을 로그인 검사에서 제외한다.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return json({ code: "notConfigured" }, 503);
  if (!isAuthorized(request, secret)) return json({ code: "unauthorized" }, 401);

  const admin = createAdminClient();
  if (!admin) return json({ code: "notConfigured" }, 503);

  const { data, error } = await admin.rpc("claim_due_notifications", { p_limit: CLAIM_LIMIT });
  if (error) {
    console.error("[notify] claim failed:", error.message);
    return json({ code: "failed" }, 500);
  }

  const due = (data ?? []) as DueNotification[];
  const counts = { claimed: due.length, sent: 0, skipped: 0, failed: 0 };

  await Promise.all(
    due.map(async (n) => {
      let result;
      try {
        result = await dispatchNotification(n);
      } catch (e) {
        console.error("[notify] dispatch threw:", n.channel, e instanceof Error ? e.name : "error");
        result = { status: "failed" as const, error: "dispatch_error" };
      }
      counts[result.status] += 1;
      // 선점한 행만 결과로 닫는다(status = 'sending' 조건으로 다른 워커·재선점과 겹치지 않게 한다).
      const { error: updateError } = await admin
        .from("notifications")
        .update({
          status: result.status,
          sent_at: result.status === "sent" ? new Date().toISOString() : null,
          error: result.status === "sent" ? null : result.error,
          claimed_at: null,
        })
        .eq("id", n.id)
        .eq("status", "sending");
      if (updateError) console.error("[notify] result update failed:", updateError.message);
    }),
  );

  return json(counts);
}
