import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 관리자 대시보드 집계. DB 함수 없이 service role로 행을 읽어 서버에서 센다(날짜는 서울 시간 기준).
// 반드시 getAdmin() 확인을 마친 뒤에만 부른다.
// 가입 정보는 Auth Admin API(listUsers)로, 나머지는 public 테이블을 REST로 읽는다. 사용자·행이 아주 많아지면 집계가 느려지므로
// 그때는 기간 제한(아래 MAX_ROWS)을 두었으니 DB 쪽 집계로 옮기는 것을 다시 검토한다.

export type StatsResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type UserStats = {
  total: number;
  formal: number;
  guest: number;
  logged_in_today: number;
  logged_in_7d: number;
  events_total: number;
  // logins·login_users는 daily_logins(로그인할 때마다 서버가 올리는 일별 횟수) 기준이라 그 기록을 시작한 날부터만 값이 있다.
  daily: { day: string; signups: number; guests: number; logins: number; login_users: number; events: number }[];
  // daily_logins 테이블을 읽을 수 있었는지(마이그레이션 미적용이면 false). 오늘 값은 서울 기준 오늘.
  login_log: { available: boolean; logins_today: number; users_today: number };
  idOwners: Map<string, { email: string | null; isGuest: boolean }>;
};

export type AiStats = {
  daily: { day: string; questions: number; prompt: number; completion: number; reasoning: number }[];
  top_users: {
    user_id: string | null;
    email: string | null;
    is_guest: boolean;
    questions: number;
    prompt: number;
    completion: number;
    reasoning: number;
  }[];
  models: { model: string; questions: number }[];
};

export type NotificationStats = {
  by_status: { channel: string; status: string; n: number }[];
  stuck_sending: number;
  overdue_pending: number;
  daily: { day: string; sent: number; failed: number; skipped: number }[];
  errors: { channel: string; reason: string; n: number }[];
};

const PAGE = 1000;
// 한 번의 집계에서 읽는 최대 행 수(과도한 읽기 방지). 넘으면 오래된 쪽이 빠진다.
const MAX_ROWS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const kstFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
// ISO 시각 → 서울 기준 'YYYY-MM-DD'
export const kstDay = (iso: string | Date) => kstFormat.format(typeof iso === "string" ? new Date(iso) : iso);

// 서울 기준 오늘부터 거꾸로 days일의 날짜 목록(오래된 날 → 오늘).
// 대시보드는 '이전 기간 대비'를 보여 주려고 일별 배열을 선택 기간의 2배(이전 기간 + 현재 기간)로 만든다: 앞 절반이 이전 기간이다.
function lastDays(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) out.push(kstDay(new Date(now - i * DAY_MS)));
  return out;
}

const sinceIso = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

type Client = NonNullable<ReturnType<typeof createAdminClient>>;
const noKey = { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다." } as const;

// PostgREST는 한 번에 가져오는 행 수가 제한돼 있어 페이지를 나눠 모은다.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null as string | null };
}

async function listAllUsers(admin: Client) {
  const users: { id: string; email: string | null; isGuest: boolean; createdAt: string; lastSignInAt: string | null }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) return { users, error: error.message };
    for (const u of data.users) {
      users.push({
        id: u.id,
        email: u.email ?? null,
        isGuest: u.is_anonymous === true,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < PAGE) break;
  }
  return { users, error: null as string | null };
}

// 가입·활동. '오늘 로그인한 사용자'·'최근 7일 로그인 사용자'는 계정의 마지막 로그인 시각(last_sign_in_at)으로 센다(과거부터 정확).
// 로그인 횟수는 로그인할 때 서버가 올리는 daily_logins로 센다(기록을 시작한 날부터).
export async function getUserStats(days: number): Promise<StatsResult<UserStats>> {
  const admin = createAdminClient();
  if (!admin) return noKey;

  const [listed, eventsCount, eventRows, loginRows] = await Promise.all([
    listAllUsers(admin),
    admin.from("events").select("id", { count: "exact", head: true }),
    fetchAll<{ created_at: string }>((from, to) =>
      admin.from("events").select("created_at").gte("created_at", sinceIso(days * 2 + 1)).order("created_at").range(from, to),
    ),
    fetchAll<{ user_id: string; day: string; count: number }>((from, to) =>
      admin.from("daily_logins").select("user_id, day, count").gte("day", kstDay(new Date(Date.now() - days * 2 * DAY_MS))).order("day").range(from, to),
    ),
  ]);
  if (listed.error) return { ok: false, message: `계정 목록을 읽지 못했습니다: ${listed.error}` };
  if (eventsCount.error) return { ok: false, message: eventsCount.error.message };
  if (eventRows.error) return { ok: false, message: eventRows.error };

  const dayList = lastDays(days * 2);
  const today = dayList[dayList.length - 1];
  const idx = new Map(dayList.map((d, i) => [d, i]));
  const daily = dayList.map((day) => ({ day, signups: 0, guests: 0, logins: 0, login_users: 0, events: 0 }));

  const weekAgo = Date.now() - 7 * DAY_MS;
  let formal = 0;
  let guest = 0;
  let loggedInToday = 0;
  let loggedIn7d = 0;
  const idOwners: UserStats["idOwners"] = new Map();
  for (const u of listed.users) {
    idOwners.set(u.id, { email: u.email, isGuest: u.isGuest });
    if (u.isGuest) guest++;
    else formal++;
    const created = idx.get(kstDay(u.createdAt));
    if (created !== undefined) {
      if (u.isGuest) daily[created].guests++;
      else daily[created].signups++;
    }
    if (u.lastSignInAt) {
      const d = kstDay(u.lastSignInAt);
      if (d === today) loggedInToday++;
      if (new Date(u.lastSignInAt).getTime() >= weekAgo) loggedIn7d++;
    }
  }
  for (const e of eventRows.rows) {
    const i = idx.get(kstDay(e.created_at));
    if (i !== undefined) daily[i].events++;
  }

  // 로그인 기록(daily_logins): 테이블이 없으면 읽기 오류가 나므로 '기록 없음'으로 표시하고 다른 통계는 그대로 보여 준다.
  const loginLog = { available: !loginRows.error, logins_today: 0, users_today: 0 };
  if (!loginRows.error) {
    for (const r of loginRows.rows) {
      const i = idx.get(r.day);
      if (i === undefined) continue;
      daily[i].logins += r.count;
      daily[i].login_users++;
      if (r.day === today) {
        loginLog.logins_today += r.count;
        loginLog.users_today++;
      }
    }
  } else {
    console.error("[admin] daily_logins read failed:", loginRows.error);
  }

  return {
    ok: true,
    data: {
      total: listed.users.length,
      formal,
      guest,
      logged_in_today: loggedInToday,
      logged_in_7d: loggedIn7d,
      events_total: eventsCount.count ?? 0,
      daily,
      login_log: loginLog,
      idOwners,
    },
  };
}

// AI 사용량. ai_usage는 90일만 보관된다. 이메일은 계정 목록(owners)에서 찾는다.
export async function getAiStats(days: number, owners: UserStats["idOwners"] | null): Promise<StatsResult<AiStats>> {
  const admin = createAdminClient();
  if (!admin) return noKey;

  const { rows, error } = await fetchAll<{
    user_id: string | null;
    is_guest: boolean;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    reasoning_tokens: number;
    created_at: string;
  }>((from, to) =>
    admin
      .from("ai_usage")
      .select("user_id, is_guest, model, prompt_tokens, completion_tokens, reasoning_tokens, created_at")
      .gte("created_at", sinceIso(days * 2 + 1))
      .order("created_at")
      .range(from, to),
  );
  if (error) return { ok: false, message: error };

  const dayList = lastDays(days * 2);
  const idx = new Map(dayList.map((d, i) => [d, i]));
  const daily = dayList.map((day) => ({ day, questions: 0, prompt: 0, completion: 0, reasoning: 0 }));
  const perUser = new Map<string, AiStats["top_users"][number]>();
  const perModel = new Map<string, number>();
  const cutoff = Date.now() - days * DAY_MS;

  for (const r of rows) {
    const i = idx.get(kstDay(r.created_at));
    if (i !== undefined) {
      daily[i].questions++;
      daily[i].prompt += r.prompt_tokens;
      daily[i].completion += r.completion_tokens;
      daily[i].reasoning += r.reasoning_tokens;
    }
    // 사용자별·모델별은 '지금부터 days일' 구간으로 센다.
    if (new Date(r.created_at).getTime() < cutoff) continue;
    perModel.set(r.model, (perModel.get(r.model) ?? 0) + 1);
    const key = r.user_id ?? "(삭제된 계정)";
    const cur =
      perUser.get(key) ??
      { user_id: r.user_id, email: r.user_id ? (owners?.get(r.user_id)?.email ?? null) : null, is_guest: r.is_guest, questions: 0, prompt: 0, completion: 0, reasoning: 0 };
    cur.questions++;
    cur.prompt += r.prompt_tokens;
    cur.completion += r.completion_tokens;
    cur.reasoning += r.reasoning_tokens;
    perUser.set(key, cur);
  }

  const total = (u: AiStats["top_users"][number]) => u.prompt + u.completion + u.reasoning;
  return {
    ok: true,
    data: {
      daily,
      top_users: [...perUser.values()].sort((a, b) => total(b) - total(a)).slice(0, 10),
      models: [...perModel.entries()].map(([model, questions]) => ({ model, questions })),
    },
  };
}

// 알림 발송 현황. 상태별 건수는 전체 기준(개수만 센다), 일별·사유는 기간 안의 행을 읽어 센다.
export async function getNotificationStats(days: number): Promise<StatsResult<NotificationStats>> {
  const admin = createAdminClient();
  if (!admin) return noKey;

  const channels = ["web_push", "kakao"] as const;
  const statuses = ["pending", "sending", "sent", "failed", "skipped"] as const;
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const counts = await Promise.all(
    channels.flatMap((channel) =>
      statuses.map(async (status) => {
        const { count, error } = await admin
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("channel", channel)
          .eq("status", status);
        return { channel, status, n: count ?? 0, error: error?.message ?? null };
      }),
    ),
  );
  const failedCount = counts.find((c) => c.error);
  if (failedCount?.error) return { ok: false, message: failedCount.error };

  const [stuck, overdue, periodRows] = await Promise.all([
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("status", "sending").lt("claimed_at", tenMinAgo),
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("status", "pending").lt("send_at", tenMinAgo),
    fetchAll<{ channel: string; status: string; send_at: string; sent_at: string | null; error: string | null }>((from, to) =>
      admin
        .from("notifications")
        .select("channel, status, send_at, sent_at, error")
        .in("status", ["sent", "failed", "skipped"])
        .gte("send_at", sinceIso(days * 2 + 1))
        .order("send_at")
        .range(from, to),
    ),
  ]);
  if (stuck.error) return { ok: false, message: stuck.error.message };
  if (overdue.error) return { ok: false, message: overdue.error.message };
  if (periodRows.error) return { ok: false, message: periodRows.error };

  const dayList = lastDays(days * 2);
  const idx = new Map(dayList.map((d, i) => [d, i]));
  const daily = dayList.map((day) => ({ day, sent: 0, failed: 0, skipped: 0 }));
  const reasons = new Map<string, { channel: string; reason: string; n: number }>();
  const cutoff = Date.now() - days * DAY_MS;

  for (const r of periodRows.rows) {
    // 성공은 실제 보낸 시각, 실패·건너뜀은 예약 시각 기준의 날짜로 센다.
    const i = idx.get(kstDay(r.status === "sent" && r.sent_at ? r.sent_at : r.send_at));
    if (i !== undefined) {
      if (r.status === "sent") daily[i].sent++;
      else if (r.status === "failed") daily[i].failed++;
      else daily[i].skipped++;
    }
    if ((r.status === "failed" || r.status === "skipped") && r.error && new Date(r.send_at).getTime() >= cutoff) {
      const reason = r.error.slice(0, 80);
      const key = `${r.channel}|${reason}`;
      const cur = reasons.get(key) ?? { channel: r.channel, reason, n: 0 };
      cur.n++;
      reasons.set(key, cur);
    }
  }

  return {
    ok: true,
    data: {
      by_status: counts.filter((c) => c.n > 0).map(({ channel, status, n }) => ({ channel, status, n })),
      stuck_sending: stuck.count ?? 0,
      overdue_pending: overdue.count ?? 0,
      daily,
      errors: [...reasons.values()].sort((a, b) => b.n - a.n).slice(0, 10),
    },
  };
}
