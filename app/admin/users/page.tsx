import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getAdmin } from "@/lib/admin/require-admin";
import { formatNumber } from "@/lib/admin/format";
import {
  getUserList,
  type UserFilter,
  type UserSort,
} from "@/lib/admin/users";
import { cn } from "@/lib/utils";
import { Notice, Section, Tile, Tiles } from "../dashboard/parts";
import { UserTable } from "./user-table";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "formal", label: "정식 계정" },
  { value: "guest", label: "게스트" },
  { value: "admin", label: "관리자" },
];
const SORTS: { value: UserSort; label: string }[] = [
  { value: "created", label: "가입일순" },
  { value: "last_login", label: "최근 로그인순" },
];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const readFilter = (v: string): UserFilter => (FILTERS.some((f) => f.value === v) ? (v as UserFilter) : "all");
const readSort = (v: string): UserSort => (SORTS.some((s) => s.value === v) ? (v as UserSort) : "created");

// 목록 링크: 현재 필터·정렬·검색을 유지하며 일부만 바꾼다.
function href(base: { filter: UserFilter; sort: UserSort; q: string }, patch: Partial<{ filter: UserFilter; sort: UserSort; q: string; page: number }>) {
  const next = { ...base, page: 1, ...patch };
  const qs = new URLSearchParams();
  if (next.filter !== "all") qs.set("filter", next.filter);
  if (next.sort !== "created") qs.set("sort", next.sort);
  if (next.q) qs.set("q", next.q);
  if (next.page > 1) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

export default function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const admin = await getAdmin();
  // 관리자가 아니면 이 경로가 없는 것처럼 404(개발 서버에서만 안내 문구).
  if (!admin.ok) {
    if (process.env.NODE_ENV === "production") notFound();
    return <Notice tone="warn">관리자 계정으로 로그인해야 볼 수 있습니다(개발 모드 안내).</Notice>;
  }

  const sp = await searchParams;
  const filter = readFilter(first(sp.filter));
  const sort = readSort(first(sp.sort));
  const q = first(sp.q).trim().slice(0, 100);
  const page = Math.max(1, Math.floor(Number(first(sp.page))) || 1);
  const base = { filter, sort, q };

  const result = await getUserList({ filter, sort, page, q });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">사용자 목록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          읽기 전용입니다. 이메일은 일부만 보여 주고, 검색은 전체 이메일(또는 사용자 ID 앞부분)로 할 수 있습니다. 일정 내용은 보지 않고 개수만 보여 줍니다.
        </p>
      </div>

      {!result.ok ? (
        <Notice tone="warn">사용자 목록을 불러오지 못했습니다: {result.message}</Notice>
      ) : (
        <>
          <Tiles>
            <Tile label="전체 계정" value={formatNumber(result.data.summary.total)} sub={`정식 ${result.data.summary.formal} · 게스트 ${result.data.summary.guest}`} />
            <Tile label="최근 7일 로그인" value={formatNumber(result.data.summary.active7d)} sub="7일 안에 로그인한 계정" />
            <Tile label="관리자" value={formatNumber(result.data.summary.admins)} />
            <Tile
              label="이메일 미확인"
              value={formatNumber(result.data.summary.unconfirmed)}
              sub="확인 메일을 아직 누르지 않은 정식 계정"
              warn={result.data.summary.unconfirmed > 0}
            />
          </Tiles>

          <Section title="목록" note={`${formatNumber(result.data.matched)}명 · ${result.data.page}/${result.data.pageCount}쪽`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <nav aria-label="필터" className="flex flex-wrap gap-1 text-xs">
                {FILTERS.map((f) => (
                  <Chip key={f.value} active={f.value === filter} href={href(base, { filter: f.value })}>
                    {f.label}
                  </Chip>
                ))}
              </nav>
              <nav aria-label="정렬" className="flex gap-1 text-xs">
                {SORTS.map((s) => (
                  <Chip key={s.value} active={s.value === sort} href={href(base, { sort: s.value })}>
                    {s.label}
                  </Chip>
                ))}
              </nav>
            </div>

            {/* 검색은 GET 폼이라 주소로 공유할 수 있고 서버 액션이 필요 없다. 필터·정렬은 숨은 값으로 유지한다. */}
            <form action="/admin/users" className="flex gap-2">
              {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
              {sort !== "created" && <input type="hidden" name="sort" value={sort} />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="이메일 또는 사용자 ID 앞부분 검색"
                aria-label="사용자 검색"
                maxLength={100}
                className="h-8 min-w-0 flex-1 rounded-md border bg-card px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <button type="submit" className="h-8 rounded-md border bg-card px-3 text-xs hover:bg-muted">
                검색
              </button>
            </form>

            <UserTable rows={result.data.rows} />

            {result.data.pageCount > 1 && (
              <nav aria-label="쪽" className="flex items-center justify-between text-xs">
                {result.data.page > 1 ? (
                  <Chip href={href(base, { page: result.data.page - 1 })}>이전</Chip>
                ) : (
                  <span />
                )}
                <span className="text-muted-foreground">
                  {result.data.page} / {result.data.pageCount}
                </span>
                {result.data.page < result.data.pageCount ? (
                  <Chip href={href(base, { page: result.data.page + 1 })}>다음</Chip>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md border px-2.5 py-1",
        active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
