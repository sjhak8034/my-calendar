import { formatNumber, maskEmail } from "@/lib/admin/format";
import { formatDateTime, formatDay, type KakaoStatus, type UserRow } from "@/lib/admin/users-format";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<string, string> = { email: "이메일", google: "Google", kakao: "카카오" };
const KAKAO_LABEL: Record<KakaoStatus, string> = { connected: "연결됨", reconnect: "재연결 필요", none: "-" };

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "warn" && "bg-destructive/10 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function UserTable({ rows }: { rows: UserRow[] }) {
  if (rows.length === 0) return <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">조건에 맞는 사용자가 없습니다.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[56rem] text-left text-xs">
        <thead className="border-b text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">사용자</th>
            <th className="px-3 py-2 font-medium">로그인 방식</th>
            <th className="px-3 py-2 font-medium">역할 / 등급</th>
            <th className="px-3 py-2 font-medium">가입일</th>
            <th className="px-3 py-2 font-medium">마지막 로그인</th>
            <th className="px-3 py-2 text-right font-medium">일정</th>
            <th className="px-3 py-2 font-medium">카카오</th>
            <th className="px-3 py-2 text-right font-medium">푸시</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="px-3 py-2">
                <p className="font-medium">{u.isGuest ? "게스트" : maskEmail(u.email)}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{u.id.slice(0, 8)}…</p>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {u.isGuest ? (
                    <Badge>게스트</Badge>
                  ) : (
                    u.providers.map((p) => <Badge key={p}>{PROVIDER_LABEL[p] ?? p}</Badge>)
                  )}
                  {!u.isGuest && u.email && !u.emailConfirmed && <Badge tone="warn">이메일 미확인</Badge>}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <Badge tone={u.role === "admin" ? "primary" : "muted"}>{u.role === "admin" ? "관리자" : "일반"}</Badge>
                  <Badge>{u.membership}</Badge>
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDay(u.createdAt)}</td>
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDateTime(u.lastSignInAt)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.events)}</td>
              <td className="px-3 py-2">
                <Badge tone={u.kakao === "reconnect" ? "warn" : "muted"}>{KAKAO_LABEL[u.kakao]}</Badge>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.pushSubscriptions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
