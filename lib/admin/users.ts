import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/admin/fetch-all";
import type { StatsResult } from "@/lib/admin/stats";

// 관리자 사용자 목록. 읽기 전용이다. 반드시 getAdmin() 확인을 마친 뒤에만 부른다.
// 계정은 Auth Admin API(listUsers)로, 역할·카카오·푸시·일정 수는 public 테이블을 service role로 읽어 서버에서 합친다.

export type UserFilter = "all" | "formal" | "guest" | "admin";
export type UserSort = "created" | "last_login";

export type KakaoStatus = "connected" | "reconnect" | "none";

export type UserRow = {
  id: string;
  email: string | null;
  isGuest: boolean;
  emailConfirmed: boolean;
  providers: string[]; // 'email', 'google' 등(게스트는 빈 배열)
  role: "user" | "admin";
  membership: string;
  createdAt: string;
  lastSignInAt: string | null;
  events: number;
  kakao: KakaoStatus;
  pushSubscriptions: number;
};

export type UserListSummary = { total: number; formal: number; guest: number; admins: number; active7d: number; unconfirmed: number };

export type UserList = {
  rows: UserRow[];
  matched: number; // 필터·검색에 맞는 사용자 수
  page: number;
  pageCount: number;
  summary: UserListSummary;
};

export const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const PER_PAGE = 1000;

type AuthUser = {
  id: string;
  email: string | null;
  isGuest: boolean;
  emailConfirmed: boolean;
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
};

type Params = { filter: UserFilter; sort: UserSort; page: number; q: string };

export async function getUserList({ filter, sort, page, q }: Params): Promise<StatsResult<UserList>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다." };

  // 1) 계정 전체(1000명씩, 최대 20쪽)
  const users: AuthUser[] = [];
  for (let p = 1; p <= 20; p++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage: PER_PAGE });
    if (error) return { ok: false, message: `계정 목록을 읽지 못했습니다: ${error.message}` };
    for (const u of data.users) {
      const providers = (u.identities ?? []).map((i) => i.provider);
      if (providers.length === 0 && u.app_metadata?.provider && u.is_anonymous !== true) providers.push(String(u.app_metadata.provider));
      users.push({
        id: u.id,
        email: u.email ?? null,
        isGuest: u.is_anonymous === true,
        emailConfirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
        providers: u.is_anonymous === true ? [] : [...new Set(providers)],
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < PER_PAGE) break;
  }

  // 2) 역할·멤버십(프로필 행이 없으면 user/free)
  const profiles = await fetchAll<{ user_id: string; role: "user" | "admin"; membership: string }>((from, to) =>
    admin.from("profiles").select("user_id, role, membership").range(from, to),
  );
  if (profiles.error) return { ok: false, message: `프로필을 읽지 못했습니다: ${profiles.error}` };
  const profileOf = new Map(profiles.rows.map((r) => [r.user_id, r]));

  // 3) 요약·필터·검색·정렬
  const weekAgo = Date.now() - 7 * DAY_MS;
  const isAdmin = (id: string) => profileOf.get(id)?.role === "admin";
  const summary: UserListSummary = {
    total: users.length,
    formal: users.filter((u) => !u.isGuest).length,
    guest: users.filter((u) => u.isGuest).length,
    admins: users.filter((u) => isAdmin(u.id)).length,
    active7d: users.filter((u) => u.lastSignInAt && new Date(u.lastSignInAt).getTime() >= weekAgo).length,
    unconfirmed: users.filter((u) => !u.isGuest && u.email && !u.emailConfirmed).length,
  };

  const needle = q.trim().toLowerCase();
  const matched = users
    .filter((u) => (filter === "formal" ? !u.isGuest : filter === "guest" ? u.isGuest : filter === "admin" ? isAdmin(u.id) : true))
    .filter((u) => !needle || (u.email ?? "").toLowerCase().includes(needle) || u.id.toLowerCase().startsWith(needle))
    .sort((a, b) => {
      const key = (u: AuthUser) => (sort === "last_login" ? (u.lastSignInAt ?? "") : u.createdAt);
      return key(b).localeCompare(key(a));
    });

  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const slice = matched.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const ids = slice.map((u) => u.id);

  // 4) 이 쪽의 사용자들만 일정 수·카카오·푸시를 읽는다.
  const [eventRows, kakaoRows, pushRows] = ids.length
    ? await Promise.all([
        fetchAll<{ user_id: string }>((from, to) => admin.from("events").select("user_id").in("user_id", ids).range(from, to)),
        fetchAll<{ user_id: string; needs_reconnect: boolean }>((from, to) =>
          admin.from("kakao_tokens").select("user_id, needs_reconnect").in("user_id", ids).range(from, to),
        ),
        fetchAll<{ user_id: string }>((from, to) => admin.from("push_subscriptions").select("user_id").in("user_id", ids).range(from, to)),
      ])
    : [
        { rows: [], error: null },
        { rows: [], error: null },
        { rows: [], error: null },
      ];
  const failed = eventRows.error ?? kakaoRows.error ?? pushRows.error;
  if (failed) return { ok: false, message: failed };

  const eventCount = new Map<string, number>();
  for (const r of eventRows.rows) eventCount.set(r.user_id, (eventCount.get(r.user_id) ?? 0) + 1);
  const pushCount = new Map<string, number>();
  for (const r of pushRows.rows) pushCount.set(r.user_id, (pushCount.get(r.user_id) ?? 0) + 1);
  const kakaoOf = new Map(kakaoRows.rows.map((r) => [r.user_id, r.needs_reconnect]));

  const rows: UserRow[] = slice.map((u) => ({
    id: u.id,
    email: u.email,
    isGuest: u.isGuest,
    emailConfirmed: u.emailConfirmed,
    providers: u.providers,
    role: profileOf.get(u.id)?.role ?? "user",
    membership: profileOf.get(u.id)?.membership ?? "free",
    createdAt: u.createdAt,
    lastSignInAt: u.lastSignInAt,
    events: eventCount.get(u.id) ?? 0,
    kakao: kakaoOf.has(u.id) ? (kakaoOf.get(u.id) ? "reconnect" : "connected") : "none",
    pushSubscriptions: pushCount.get(u.id) ?? 0,
  }));

  return { ok: true, data: { rows, matched: matched.length, page: current, pageCount, summary } };
}
