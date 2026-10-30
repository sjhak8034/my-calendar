import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatsResult } from "@/lib/admin/stats";

// 정리 작업 현황: 보관 기간이 지난 데이터가 실제로 지워졌는지 확인한다(읽기 전용). 반드시 getAdmin() 확인을 마친 뒤에만 부른다.
// 정리 자체는 DB 함수(purge_*)가 하고 매일 03:00(KST)에 pg_cron이 부르도록 설계돼 있다(supabase/cron/schedule.sql).
// pg_cron의 실행 기록(cron.job_run_details)은 REST로 읽을 수 없어 '마지막 실행 시각'은 앱에서 알 수 없다.
// 대신 '보관 기간을 지났는데 남아 있는 건수'로 정리가 되고 있는지 판단한다. 하루 한 번 도는 작업이라 만료 후 1일까지는 지연으로 보지 않는다.

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 1;

export type CleanupRule = {
  key: "ai_chats" | "ai_usage" | "notifications" | "guests";
  title: string;
  retention: string; // 보관 규칙 설명
  how: string; // 정리되는 방식
  total: number; // 전체 건수
  expired: number; // 보관 기간을 지난 건수
  overdue: number; // 보관 기간 + 1일을 지났는데 남은 건수(지연 판단 기준)
  oldest: string | null; // 가장 오래된 데이터의 시각
  // guests는 활동 중인 게스트가 남을 수 있어 건수만으로 지연을 판정할 수 없다.
  judge: "auto" | "reference";
};

export type CleanupStatus = { rules: CleanupRule[]; nextRunKst: string };

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY_MS).toISOString();

// 다음 정리 예정 시각(서울 03:00)의 'M/D HH:mm' 표시.
function nextRun(): string {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const next = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 3, 0, 0));
  if (next.getTime() <= kstNow.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return `${next.getUTCMonth() + 1}/${next.getUTCDate()} 03:00`;
}

export async function getCleanupStatus(): Promise<StatsResult<CleanupStatus>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다." };

  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await q;
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  const oldestOf = async (q: PromiseLike<{ data: Record<string, string>[] | null; error: { message: string } | null }>, column: string) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data?.[0]?.[column] ?? null;
  };

  try {
    const doneStatuses = ["sent", "failed", "skipped"];
    const [
      chatsTotal, chatsExpired, chatsOverdue, chatsOldest,
      usageTotal, usageExpired, usageOverdue, usageOldest,
      notifTotal, notifExpired, notifOverdue, notifOldest,
    ] = await Promise.all([
      count(admin.from("ai_conversations").select("id", { count: "exact", head: true })),
      count(admin.from("ai_conversations").select("id", { count: "exact", head: true }).lte("updated_at", iso(30))),
      count(admin.from("ai_conversations").select("id", { count: "exact", head: true }).lte("updated_at", iso(30 + GRACE_DAYS))),
      oldestOf(admin.from("ai_conversations").select("updated_at").order("updated_at").limit(1), "updated_at"),
      count(admin.from("ai_usage").select("id", { count: "exact", head: true })),
      count(admin.from("ai_usage").select("id", { count: "exact", head: true }).lt("created_at", iso(90))),
      count(admin.from("ai_usage").select("id", { count: "exact", head: true }).lt("created_at", iso(90 + GRACE_DAYS))),
      oldestOf(admin.from("ai_usage").select("created_at").order("created_at").limit(1), "created_at"),
      count(admin.from("notifications").select("id", { count: "exact", head: true }).in("status", doneStatuses)),
      count(admin.from("notifications").select("id", { count: "exact", head: true }).in("status", doneStatuses).lt("send_at", iso(30))),
      count(admin.from("notifications").select("id", { count: "exact", head: true }).in("status", doneStatuses).lt("send_at", iso(30 + GRACE_DAYS))),
      oldestOf(admin.from("notifications").select("send_at").in("status", doneStatuses).order("send_at").limit(1), "send_at"),
    ]);

    // 게스트: Auth Admin API로 계정 전체를 읽어 센다(1000명씩, 최대 20쪽).
    const guests: { createdAt: string }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      for (const u of data.users) if (u.is_anonymous === true) guests.push({ createdAt: u.created_at });
      if (data.users.length < 1000) break;
    }
    const guestCut = Date.now() - 30 * DAY_MS;
    const guestExpired = guests.filter((g) => new Date(g.createdAt).getTime() < guestCut).length;
    const guestOldest = guests.reduce<string | null>((a, g) => (a === null || g.createdAt < a ? g.createdAt : a), null);

    return {
      ok: true,
      data: {
        nextRunKst: nextRun(),
        rules: [
          {
            key: "ai_chats",
            title: "AI 대화",
            retention: "마지막 대화 후 30일",
            how: "만료된 대화는 화면에서 바로 숨겨지고, 질문할 때마다 일부가 삭제되며 매일 정리 작업이 나머지를 삭제",
            total: chatsTotal, expired: chatsExpired, overdue: chatsOverdue, oldest: chatsOldest, judge: "auto",
          },
          {
            key: "ai_usage",
            title: "AI 사용 기록",
            retention: "90일",
            how: "AI 질문을 기록할 때마다 일부를 삭제",
            total: usageTotal, expired: usageExpired, overdue: usageOverdue, oldest: usageOldest, judge: "auto",
          },
          {
            key: "notifications",
            title: "알림 발송 기록",
            retention: "발송 후 30일(성공·실패·건너뜀)",
            how: "매일 정리 작업이 삭제",
            total: notifTotal, expired: notifExpired, overdue: notifOverdue, oldest: notifOldest, judge: "auto",
          },
          {
            key: "guests",
            title: "게스트 계정",
            retention: "만든 지 30일이 지나고 30일 동안 세션이 갱신되지 않은 계정",
            how: "로그아웃하면 즉시 삭제, 방치된 계정은 매일 정리 작업이 삭제",
            total: guests.length, expired: guestExpired, overdue: guestExpired, oldest: guestOldest, judge: "reference",
          },
        ],
      },
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "알 수 없는 오류" };
  }
}
