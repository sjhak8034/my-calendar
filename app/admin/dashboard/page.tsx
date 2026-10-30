import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getAdmin } from "@/lib/admin/require-admin";
import { estimateCost, getPricing } from "@/lib/admin/pricing";
import { getAiStats, getNotificationStats, getUserStats } from "@/lib/admin/stats";
import { formatKrw, formatNumber, formatUsd, maskEmail, shortDay } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { BarList, Notice, Panel, Section, Tile, Tiles } from "./parts";
import { PricingForm } from "./pricing-form";

const PERIODS = [7, 14, 30] as const;
type Period = (typeof PERIODS)[number];

function readPeriod(value: string | string[] | undefined): Period {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 14;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const admin = await getAdmin();
  // 관리자가 아니면 이 경로가 없는 것처럼 404(개발 서버에서만 안내 문구).
  if (!admin.ok) {
    if (process.env.NODE_ENV === "production") notFound();
    return <Notice tone="warn">관리자 계정으로 로그인해야 볼 수 있습니다(개발 모드 안내).</Notice>;
  }

  const days = readPeriod((await searchParams).days);
  // 사용자 목록은 AI 사용자별 표의 이메일 조회에도 쓰므로 먼저 읽는다.
  const users = await getUserStats(days);
  const [ai, notif, pricingResult] = await Promise.all([
    getAiStats(days, users.ok ? users.data.idOwners : null),
    getNotificationStats(days),
    getPricing(),
  ]);
  const pricing = pricingResult.pricing;

  // 서울 기준 오늘(마지막 행). 일별 배열은 오래된 날부터 오늘까지다.
  const todayAi = ai.ok ? ai.data.daily.at(-1) : undefined;
  const todayNotif = notif.ok ? notif.data.daily.at(-1) : undefined;

  const aiTotals = ai.ok
    ? ai.data.daily.reduce(
        (a, d) => ({
          questions: a.questions + d.questions,
          prompt: a.prompt + d.prompt,
          completion: a.completion + d.completion,
          reasoning: a.reasoning + d.reasoning,
        }),
        { questions: 0, prompt: 0, completion: 0, reasoning: 0 },
      )
    : null;
  const aiCost = aiTotals ? estimateCost(aiTotals, pricing) : null;
  const todayCost = todayAi ? estimateCost(todayAi, pricing) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">통계 대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">날짜는 서울 시간 기준입니다. 개인 일정 내용은 보지 않고 숫자만 집계합니다.</p>
        </div>
        <nav aria-label="기간" className="flex gap-1 text-xs">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/dashboard?days=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={cn(
                "rounded-md border px-2.5 py-1",
                p === days ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              최근 {p}일
            </Link>
          ))}
        </nav>
      </div>

      {/* 오늘 */}
      <Section title="오늘">
        <Tiles>
          <Tile
            label="오늘 로그인한 사용자"
            value={users.ok ? formatNumber(users.data.logged_in_today) : "-"}
            sub="오늘 마지막으로 로그인한 계정 수"
          />
          <Tile
            label="오늘 로그인 횟수"
            value={users.ok && users.data.login_log.available ? formatNumber(users.data.login_log.logins_today) : "-"}
            sub={users.ok && !users.data.login_log.available ? "로그인 기록 테이블이 없습니다" : "로그인 동작을 센 횟수(재방문 제외)"}
          />
          <Tile label="오늘 AI 질문" value={todayAi ? formatNumber(todayAi.questions) : "-"} sub={todayCost ? `예상 ${formatKrw(todayCost.krw)}` : undefined} />
          <Tile label="오늘 알림 발송 성공" value={todayNotif ? formatNumber(todayNotif.sent) : "-"} sub={todayNotif ? `실패 ${todayNotif.failed} · 건너뜀 ${todayNotif.skipped}` : undefined} />
        </Tiles>
        <Notice>
          로그인 횟수는 로그인할 때마다 서버가 올린 기록이라 기록을 시작한 날부터만 값이 있습니다. 이미 로그인된 채로 다시 방문한 것과 페이지를 연 횟수는 세지 않습니다. &apos;오늘 로그인한 사용자&apos;는 계정의 마지막 로그인 시각 기준이라 기록 시작 전에도 정확합니다.
        </Notice>
      </Section>

      {/* 가입·활동 */}
      <Section title="가입·활동 현황" note={`최근 ${days}일`}>
        {users.ok ? (
          <>
            <Tiles>
              <Tile label="전체 계정" value={formatNumber(users.data.total)} sub={`정식 ${users.data.formal} · 게스트 ${users.data.guest}`} />
              <Tile label="최근 7일 로그인 사용자" value={formatNumber(users.data.logged_in_7d)} sub="7일 안에 로그인한 계정 수" />
              <Tile label="전체 일정 수" value={formatNumber(users.data.events_total)} sub="내용은 보지 않고 개수만" />
              <Tile
                label={`${days}일간 가입`}
                value={formatNumber(users.data.daily.reduce((a, d) => a + d.signups + d.guests, 0))}
                sub={`정식 ${users.data.daily.reduce((a, d) => a + d.signups, 0)} · 게스트 ${users.data.daily.reduce((a, d) => a + d.guests, 0)}`}
              />
            </Tiles>
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="일별 가입 (정식+게스트)">
                <BarList rows={users.data.daily.map((d) => ({ label: shortDay(d.day), value: d.signups + d.guests }))} />
              </Panel>
              <Panel title="일별 로그인 횟수">
                <BarList rows={users.data.daily.map((d) => ({ label: shortDay(d.day), value: d.logins }))} />
              </Panel>
              <Panel title="일별 로그인한 사용자">
                <BarList rows={users.data.daily.map((d) => ({ label: shortDay(d.day), value: d.login_users }))} />
              </Panel>
              <Panel title="일별 새로 만든 일정">
                <BarList rows={users.data.daily.map((d) => ({ label: shortDay(d.day), value: d.events }))} />
              </Panel>
            </div>
          </>
        ) : (
          <Notice tone="warn">가입·활동 통계를 불러오지 못했습니다: {users.message}</Notice>
        )}
      </Section>

      {/* AI */}
      <Section title="AI 사용량·비용" note={`최근 ${days}일 · 사용 기록은 90일만 보관됩니다`}>
        {ai.ok && aiTotals ? (
          <>
            <Tiles>
              <Tile label="질문 수" value={formatNumber(aiTotals.questions)} sub={ai.data.models.map((m) => `${m.model} ${m.questions}`).join(" · ") || undefined} />
              <Tile label="입력 토큰" value={formatNumber(aiTotals.prompt)} />
              <Tile label="출력 토큰" value={formatNumber(aiTotals.completion + aiTotals.reasoning)} sub={aiTotals.reasoning ? `추론 ${formatNumber(aiTotals.reasoning)} 포함` : undefined} />
              <Tile
                label="예상 비용"
                value={aiCost ? formatKrw(aiCost.krw) : "단가 미설정"}
                sub={aiCost ? `${formatUsd(aiCost.usd)} · 질문당 ${aiTotals.questions ? formatKrw(aiCost.krw / aiTotals.questions) : "-"}` : "아래에서 단가를 저장하세요"}
              />
            </Tiles>
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="일별 질문 수">
                <BarList rows={ai.data.daily.map((d) => ({ label: shortDay(d.day), value: d.questions }))} />
              </Panel>
              <Panel title={pricing ? "일별 예상 비용 (원)" : "일별 토큰 수 (입력+출력)"}>
                <BarList
                  rows={ai.data.daily.map((d) => {
                    const cost = estimateCost(d, pricing);
                    return cost
                      ? { label: shortDay(d.day), value: cost.krw, display: formatKrw(cost.krw) }
                      : { label: shortDay(d.day), value: d.prompt + d.completion + d.reasoning };
                  })}
                />
              </Panel>
            </div>
            <Panel title="사용자별 상위 10명 (토큰 기준)">
              {ai.data.top_users.length === 0 ? (
                <p className="text-xs text-muted-foreground">이 기간에 AI 질문이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-medium">사용자</th>
                        <th className="py-1 pr-3 text-right font-medium">질문</th>
                        <th className="py-1 pr-3 text-right font-medium">입력 토큰</th>
                        <th className="py-1 pr-3 text-right font-medium">출력 토큰</th>
                        <th className="py-1 text-right font-medium">예상 비용</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ai.data.top_users.map((u, i) => {
                        const cost = estimateCost(u, pricing);
                        return (
                          <tr key={u.user_id ?? i}>
                            <td className="py-1.5 pr-3">{u.is_guest ? "게스트" : maskEmail(u.email)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumber(u.questions)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumber(u.prompt)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumber(u.completion + u.reasoning)}</td>
                            <td className="py-1.5 text-right tabular-nums">{cost ? formatKrw(cost.krw) : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        ) : (
          <Notice tone="warn">AI 통계를 불러오지 못했습니다: {ai.ok ? "" : ai.message}</Notice>
        )}
        <Panel title="AI 요금 단가">
          {pricingResult.error && <Notice tone="warn">단가를 읽지 못했습니다: {pricingResult.error}</Notice>}
          <PricingForm initial={pricing} updatedAt={pricingResult.updatedAt} />
        </Panel>
      </Section>

      {/* 알림 */}
      <Section title="알림 발송 현황" note={`최근 ${days}일 (상태별 건수는 전체)`}>
        {notif.ok ? (
          <>
            {(notif.data.overdue_pending > 0 || notif.data.stuck_sending > 0) && (
              <Notice tone="warn">
                발송 시각이 10분 넘게 지났는데 대기 중인 알림 {notif.data.overdue_pending}건, 10분 넘게 &apos;발송 중&apos;인 알림 {notif.data.stuck_sending}건이 있습니다. 알림 워커(pg_cron)가 도는지 확인하세요.
              </Notice>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="상태별 건수 (전체)">
                {notif.data.by_status.length === 0 ? (
                  <p className="text-xs text-muted-foreground">알림 기록이 없습니다.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">채널</th>
                        <th className="py-1 font-medium">상태</th>
                        <th className="py-1 text-right font-medium">건수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {notif.data.by_status.map((r) => (
                        <tr key={`${r.channel}-${r.status}`}>
                          <td className="py-1.5">{r.channel === "kakao" ? "카카오톡" : r.channel === "web_push" ? "웹 푸시" : r.channel}</td>
                          <td className="py-1.5">{r.status}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatNumber(r.n)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
              <Panel title="일별 발송 성공">
                <BarList rows={notif.data.daily.map((d) => ({ label: shortDay(d.day), value: d.sent }))} />
              </Panel>
              <Panel title="일별 실패">
                <BarList rows={notif.data.daily.map((d) => ({ label: shortDay(d.day), value: d.failed }))} />
              </Panel>
              <Panel title="실패·건너뜀 사유 (상위 10)">
                {notif.data.errors.length === 0 ? (
                  <p className="text-xs text-muted-foreground">이 기간에 실패한 알림이 없습니다.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5 text-xs">
                    {notif.data.errors.map((e, i) => (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-words">
                          <span className="text-muted-foreground">{e.channel === "kakao" ? "카카오" : "푸시"} · </span>
                          {e.reason}
                        </span>
                        <span className="shrink-0 tabular-nums">{e.n}건</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        ) : (
          <Notice tone="warn">알림 통계를 불러오지 못했습니다: {notif.message}</Notice>
        )}
      </Section>
    </div>
  );
}
