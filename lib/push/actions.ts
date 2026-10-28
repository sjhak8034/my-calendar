"use server";

import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { hitRateLimit } from "@/lib/rate-limit";
import { sendPushToUser } from "@/lib/notify/web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/require-user";
import { PUSH_MAX_SUBSCRIPTIONS, parsePushEndpoint, parsePushSubscription } from "./input";

export type PushResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "validation" | "limit" | "failed" };

type Session = NonNullable<Awaited<ReturnType<typeof requireUser>>>;

// 이 계정이 웹 푸시를 켜 둔 상태인지 저장한다(사용자 메타데이터). 브라우저 구독과 별개라서, 로그아웃으로 구독이 해제돼도
// 켜 둔 상태는 남고 다시 로그인하면 권한이 허용된 브라우저에서 자동으로 다시 구독한다. 실패해도 구독 자체는 유효하다.
async function savePushPreference(session: Session, enabled: boolean) {
  if ((session.user.user_metadata?.push_enabled === true) === enabled) return;
  const { error } = await session.supabase.auth.updateUser({ data: { push_enabled: enabled } });
  if (error) console.error("[push] save preference failed:", error.code ?? "unknown");
}

// 이 브라우저의 푸시 구독을 저장한다. lang은 발송 워커가 알림 문구의 언어를 정하는 데 쓴다.
// Server Action은 직접 POST로도 호출되므로 로그인과 입력을 서버에서 매번 확인한다.
export async function subscribePush(subscription: unknown, lang: unknown): Promise<PushResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  const parsed = parsePushSubscription(subscription);
  const language = typeof lang === "string" && hasLocale(lang) ? lang : null;
  if (!parsed || !language) return { ok: false, code: "validation" };

  // 본인 구독 목록(RLS). 이미 등록된 endpoint를 다시 저장하는 것은 갱신이라 한도에 세지 않는다.
  const { data: mine, error } = await session.supabase.from("push_subscriptions").select("endpoint");
  if (error) {
    console.error("[push] list subscriptions failed:", error.message);
    return { ok: false, code: "failed" };
  }
  const known = mine.some((row) => row.endpoint === parsed.endpoint);
  if (!known && mine.length >= PUSH_MAX_SUBSCRIPTIONS) return { ok: false, code: "limit" };

  // 같은 브라우저에서 계정을 바꾸면 endpoint가 이전 계정의 행에 남아 있다(endpoint는 unique).
  // 그 행은 RLS 때문에 사용자 클라이언트로 옮길 수 없어 service role로 소유자를 현재 사용자로 바꾼다.
  // endpoint와 키는 그 브라우저만 아는 값이라 남이 알아내 가로챌 수 없다.
  const admin = createAdminClient();
  if (!admin) {
    console.error("[push] subscribe failed: SUPABASE_SERVICE_ROLE_KEY is not set");
    return { ok: false, code: "failed" };
  }
  const { error: upsertError } = await admin.from("push_subscriptions").upsert(
    { user_id: session.user.id, endpoint: parsed.endpoint, keys: parsed.keys, lang: language },
    { onConflict: "endpoint" },
  );
  if (upsertError) {
    console.error("[push] subscribePush failed:", upsertError.message);
    return { ok: false, code: "failed" };
  }
  await savePushPreference(session, true);
  return { ok: true };
}

// 구독을 해제한다. 로그아웃 때 이 브라우저의 구독을 정리하는 데 쓰며, 켜 둔 상태는 그대로 둔다(다시 로그인하면 자동 복원).
// RLS가 본인 행만 보이게 하므로 남의 endpoint를 넘겨도 아무것도 지워지지 않는다.
// 이미 없는 구독이어도 성공으로 본다.
export async function unsubscribePush(endpoint: unknown): Promise<PushResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  const parsed = parsePushEndpoint(endpoint);
  if (!parsed) return { ok: false, code: "validation" };

  const { error } = await session.supabase.from("push_subscriptions").delete().eq("endpoint", parsed);
  if (error) {
    console.error("[push] unsubscribePush failed:", error.message);
    return { ok: false, code: "failed" };
  }
  return { ok: true };
}

// 사용자가 설정에서 웹 푸시를 직접 끈다: 이 브라우저의 구독을 지우고 켜 둔 상태도 해제해 자동 복원되지 않게 한다.
export async function disablePush(endpoint: unknown): Promise<PushResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  const parsed = parsePushEndpoint(endpoint);
  if (!parsed) return { ok: false, code: "validation" };

  const { error } = await session.supabase.from("push_subscriptions").delete().eq("endpoint", parsed);
  if (error) {
    console.error("[push] disablePush failed:", error.message);
    return { ok: false, code: "failed" };
  }
  await savePushPreference(session, false);
  return { ok: true };
}

export type TestPushResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "notSubscribed" | "rateLimited" | "failed" };

// 설정 화면의 "테스트 알림 보내기": 본인 구독에만 보낸다.
export async function sendTestPush(): Promise<TestPushResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };

  // 푸시 서비스를 반복해서 부르지 못하게 사용자당 1분에 3번까지만 보낸다.
  const limit = await hitRateLimit(session.supabase, "push_test", 3, 60);
  if (limit === "limited") return { ok: false, code: "rateLimited" };
  if (limit === "error") return { ok: false, code: "failed" };

  let summary;
  try {
    summary = await sendPushToUser(session.user.id, async (lang) => {
      const { notify } = await getDictionary(lang);
      return { title: notify.testTitle, body: notify.testBody, url: `/${lang}/settings`, tag: "test" };
    });
  } catch (e) {
    console.error("[push] sendTestPush failed:", e instanceof Error ? e.name : "error");
    return { ok: false, code: "failed" };
  }
  if (!summary) return { ok: false, code: "failed" };
  if (summary.sent > 0) return { ok: true };
  return { ok: false, code: summary.failed > 0 ? "failed" : "notSubscribed" };
}
