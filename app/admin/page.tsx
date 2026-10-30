import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getAdmin, type AdminReason } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

const REASON_TEXT: Record<AdminReason, string> = {
  "no-session": "로그인되어 있지 않습니다. 일반 로그인 화면에서 먼저 로그인하세요.",
  guest: "게스트(익명) 계정은 관리자가 될 수 없습니다.",
  "lookup-failed":
    "역할 조회에 실패했습니다. 마이그레이션(20261102000001_profiles_role.sql)을 Supabase에서 실행했는지 확인하세요.",
  "not-admin":
    "이 계정은 관리자가 아닙니다. Supabase SQL 편집기에서 profiles 행을 추가해 관리자로 지정하세요(마이그레이션 파일 위쪽 주석 참고).",
};

// 이메일은 앞 두 글자만 보여 주고 나머지는 가린다.
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email || "(이메일 없음)";
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

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
