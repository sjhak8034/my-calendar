import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getAdmin, type AdminReason } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskEmail } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

const REASON_TEXT: Record<AdminReason, string> = {
  "no-session": "로그인되어 있지 않습니다. 일반 로그인 화면에서 먼저 로그인하세요.",
  guest: "게스트(익명) 계정은 관리자가 될 수 없습니다.",
  "lookup-failed":
    "역할 조회에 실패했습니다. 마이그레이션(20261102000001_profiles_role.sql)을 Supabase에서 실행했는지 확인하세요.",
  "not-admin":
    "이 계정은 관리자가 아닙니다. Supabase SQL 편집기에서 profiles 행을 추가해 관리자로 지정하세요(마이그레이션 파일 위쪽 주석 참고).",
};

// 구현 예정인 관리자 기능 목록(점검 페이지에서 진행 상황을 한눈에 보려는 용도). 구현하면 status를 "done"으로 바꾼다.
type PlannedItem = { name: string; description: string; status: "planned" | "done" };
const PLANNED: { title: string; note: string; items: PlannedItem[] }[] = [
  {
    title: "먼저 하면 좋은 것",
    note: "가치가 크고 위험이 낮음",
    items: [
      { name: "AI 사용량·비용 대시보드", description: "일별 질문 수, 토큰 수, 예상 비용, 사용자별 상위 순위(ai_usage 테이블 사용). 비용 급증을 가장 먼저 알아채는 화면.", status: "done" },
      { name: "가입·활동 현황", description: "일별 가입 수, 정식 계정과 게스트 비율, 최근 7일 활동 사용자 수, 전체 일정 수 추이. 일정 내용은 보지 않고 숫자만.", status: "done" },
      { name: "알림 발송 현황", description: "웹 푸시·카카오 알림의 성공·실패 건수와 실패 사유 모음(만료된 구독, 카카오 재연결 필요 등). 알림 워커 점검용.", status: "done" },
    ],
  },
  {
    title: "운영에 도움 되는 것",
    note: "중간",
    items: [
      { name: "사용자 목록과 상태", description: "가입일, 마지막 로그인, 로그인 방식(이메일·Google·게스트), 카카오 연결 여부. 이메일은 일부만 가려서 표시.", status: "done" },
      { name: "AI 사용 제한 조정", description: "모든 사용자 공통 하루 사용 금액(원) 한도를 대시보드 상단 슬라이더로 조절(사용자별 한도·계정 차단은 아직 없음).", status: "done" },
      { name: "정리 작업 현황", description: "30일 지난 게스트·AI 대화가 실제로 지워졌는지, 마지막 실행 시각(보관 기간 준수 확인).", status: "done" },
      { name: "오류 모음", description: "서버 로그에서 최근 오류를 모아 보기(모니터링 서비스 도입 전 임시 대안).", status: "planned" },
    ],
  },
  {
    title: "신중해야 하는 것",
    note: "민감하거나 되돌리기 어려움",
    items: [
      { name: "사용자 계정 정지·삭제", description: "남용 계정 차단. 복구가 안 되므로 확인 단계와 변경 기록이 필요(DB 백업도 아직 없음).", status: "planned" },
      { name: "다른 사용자의 일정·AI 대화 열람", description: "문의 대응용. 개인정보 방침에 운영자 열람 고지가 필요하고 법적 부담이 커서 처음에는 넣지 않는 편이 안전.", status: "planned" },
      { name: "공지·점검 안내 배너", description: "앱 상단에 공지 표시. 별도 테이블과 표시 영역이 필요.", status: "planned" },
    ],
  },
  {
    title: "나중에 고려",
    note: "",
    items: [
      { name: "문의·신고 접수함", description: "", status: "planned" },
      { name: "기능 플래그", description: "실험 기능 켜고 끄기.", status: "planned" },
      { name: "시스템 설정 편집", description: "모델 이름, 한도 등을 화면에서 편집.", status: "planned" },
    ],
  },
];

export default function AdminPage() {
  // 로그인 사용자는 요청 시점 데이터라 Suspense 안에서 읽는다(cacheComponents).
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">확인 중…</p>}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  await connection();
  const admin = await getAdmin();

  // 운영에서는 관리자가 아니면 이 경로가 없는 것처럼 404. 개발 서버에서만 원인을 보여 준다(개발 점검용).
  if (!admin.ok && process.env.NODE_ENV === "production") notFound();

  // service role 연결 점검: 읽기만 한다(profiles 행 수).
  let serviceCheck: { ok: boolean; text: string } = { ok: false, text: "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다." };
  const service = createAdminClient();
  if (service) {
    const { count, error } = await service.from("profiles").select("user_id", { count: "exact", head: true });
    serviceCheck = error
      ? { ok: false, text: `조회 실패: ${error.message}` }
      : { ok: true, text: `연결됨 (profiles ${count ?? 0}행)` };
  }

  let supabaseHost = "(설정 없음)";
  try {
    supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    // 값이 없거나 올바르지 않으면 위 기본 문구를 쓴다.
  }
  const present = (name: string) => Boolean(process.env[name]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">관리자 점검</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          관리자 영역이 제대로 열리는지 확인하는 개발용 화면입니다. 값(키·비밀번호)은 표시하지 않고 설정 여부만 보여 줍니다.
        </p>
      </div>

      <Section title="접근 제어">
        <Row
          label="관리자 확인"
          ok={admin.ok}
          value={admin.ok ? "통과" : REASON_TEXT[admin.reason]}
        />
        {admin.ok && (
          <>
            <Row label="계정" ok value={maskEmail(admin.email)} />
            <Row label="역할 / 멤버십" ok value={`admin / ${admin.membership}`} mono />
            <Row label="사용자 ID" ok value={`${admin.userId.slice(0, 8)}…`} mono />
          </>
        )}
        {!admin.ok && admin.detail && <Row label="상세" ok={false} value={admin.detail} mono />}
      </Section>

      {admin.ok && (
        <>
          <Section title="서버 연결">
            <Row label="service role 연결" ok={serviceCheck.ok} value={serviceCheck.text} />
            <Row label="Supabase 프로젝트" ok value={supabaseHost} mono />
          </Section>

          <Section title="환경 변수 (설정 여부만)">
            {[
              "NEXT_PUBLIC_SUPABASE_URL",
              "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
              "SUPABASE_SERVICE_ROLE_KEY",
              "SITE_URL",
              "GEMINI_API_KEY",
              "CRON_SECRET",
              "NEXT_PUBLIC_KAKAO_MAP_KEY",
            ].map((name) => (
              <Row key={name} label={name} ok={present(name)} value={present(name) ? "설정됨" : "없음"} mono />
            ))}
          </Section>

          <Section title="환경">
            <Row label="실행 모드" ok value={process.env.NODE_ENV ?? "-"} mono />
          </Section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">구현 예정 기능</h2>
            {PLANNED.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {group.title}
                  {group.note && ` · ${group.note}`}
                </h3>
                <ul className="divide-y rounded-lg border bg-card">
                  {group.items.map((item) => (
                    <li key={item.name} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs",
                          item.status === "done" ? "bg-green-600/15 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.status === "done" ? "완료" : "예정"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="divide-y rounded-lg border bg-card">{children}</div>
    </section>
  );
}

function Row({ label, ok, value, mono }: { label: string; ok: boolean; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
      <span className={cn("shrink-0", mono && "font-mono text-xs")}>{label}</span>
      <span className="flex min-w-0 items-start gap-2 text-right">
        <span className={cn("min-w-0 break-words", mono && "font-mono text-xs")}>{value}</span>
        <span
          aria-label={ok ? "정상" : "문제"}
          className={cn("mt-1 size-2 shrink-0 rounded-full", ok ? "bg-green-600" : "bg-destructive")}
        />
      </span>
    </div>
  );
}
