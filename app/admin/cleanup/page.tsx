import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getAdmin } from "@/lib/admin/require-admin";
import { formatNumber } from "@/lib/admin/format";
import { getCleanupStatus, type CleanupRule } from "@/lib/admin/cleanup";
import { getNotificationStats } from "@/lib/admin/stats";
import { formatDateTime } from "@/lib/admin/users-format";
import { cn } from "@/lib/utils";
import { Notice, Section } from "../dashboard/parts";

export default function CleanupPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}>
      <CleanupContent />
    </Suspense>
  );
}

type Verdict = { label: string; tone: "ok" | "warn" | "info" };

// 판정: 보관 기간 + 1일을 지났는데 남은 것이 있으면 지연. 게스트는 활동 중인 계정이 남을 수 있어 참고로만 보여 준다.
function judge(rule: CleanupRule): Verdict {
  if (rule.judge === "reference") {
    return rule.expired === 0 ? { label: "해당 없음", tone: "ok" } : { label: "확인 필요", tone: "info" };
  }
  return rule.overdue === 0 ? { label: "정상", tone: "ok" } : { label: "지연", tone: "warn" };
}

async function CleanupContent() {
  await connection();
  const admin = await getAdmin();
  // 관리자가 아니면 이 경로가 없는 것처럼 404(개발 서버에서만 안내 문구).
  if (!admin.ok) {
    if (process.env.NODE_ENV === "production") notFound();
    return <Notice tone="warn">관리자 계정으로 로그인해야 볼 수 있습니다(개발 모드 안내).</Notice>;
  }

  const [result, notif] = await Promise.all([getCleanupStatus(), getNotificationStats(1)]);
  const delayed = result.ok ? result.data.rules.filter((r) => judge(r).tone === "warn") : [];
  // 알림 워커·정리 작업은 같은 pg_cron이 돌린다. 발송 시각이 10분 넘게 지난 대기 알림이 있으면 스케줄러가 멈춘 신호다.
  const schedulerSuspect = notif.ok && notif.data.overdue_pending > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">정리 작업 현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          보관 기간이 지난 데이터가 실제로 지워지고 있는지 확인합니다(읽기 전용). 정리는 매일 03:00(서울)에 도는 작업이라 만료 후 1일까지는 지연으로 보지 않습니다.
        </p>
      </div>

      {schedulerSuspect && (
        <Notice tone="warn">
          발송 시각이 10분 넘게 지났는데 대기 중인 알림이 {notif.ok ? notif.data.overdue_pending : 0}건 있습니다. 알림 발송과 매일 정리는 같은 스케줄러(Supabase pg_cron)가 부르므로, 스케줄러가 설정돼 있지 않거나 멈췄을 수 있습니다. supabase/cron/schedule.sql을 실행했는지 확인하세요.
        </Notice>
      )}

      {!result.ok ? (
        <Notice tone="warn">정리 현황을 불러오지 못했습니다: {result.message}</Notice>
      ) : (
        <>
          {delayed.length > 0 && (
            <Notice tone="warn">
              보관 기간이 지났는데 남아 있는 데이터가 있습니다: {delayed.map((r) => `${r.title} ${formatNumber(r.overdue)}건`).join(", ")}. 정리 작업이 돌지 않았을 수 있습니다.
            </Notice>
          )}

          <Section title="항목별 현황" note={`다음 정리 예정: ${result.data.nextRunKst} (서울)`}>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[44rem] text-left text-xs">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">항목</th>
                    <th className="px-3 py-2 font-medium">보관 기간</th>
                    <th className="px-3 py-2 text-right font-medium">전체</th>
                    <th className="px-3 py-2 text-right font-medium">기간 지난 것</th>
                    <th className="px-3 py-2 font-medium">가장 오래된 데이터</th>
                    <th className="px-3 py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.data.rules.map((r) => {
                    const v = judge(r);
                    return (
                      <tr key={r.key} className="align-top">
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.title}</p>
                          <p className="mt-0.5 max-w-xs text-[11px] text-muted-foreground">{r.how}</p>
                        </td>
                        <td className="px-3 py-2">{r.retention}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.expired)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDateTime(r.oldest)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap",
                              v.tone === "ok" && "bg-green-600/15 text-green-700 dark:text-green-400",
                              v.tone === "warn" && "bg-destructive/10 text-destructive",
                              v.tone === "info" && "bg-muted text-muted-foreground",
                            )}
                          >
                            {v.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Notice>
            마지막 실행 시각은 표시하지 못합니다. 정리 스케줄러(pg_cron)의 실행 기록은 앱에서 읽을 수 없어서, 대신 &apos;기간이 지났는데 남은 건수&apos;로 정리가 되고 있는지 판단합니다. 실행 기록은 Supabase 대시보드의 Cron 메뉴(또는 SQL 편집기에서 cron.job_run_details)에서 확인할 수 있습니다. 게스트는 활동 중인 계정이 남을 수 있어 &quot;확인 필요&quot;는 지연이 아니라 참고 표시입니다.
          </Notice>
        </>
      )}
    </div>
  );
}
