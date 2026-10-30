import "server-only";
import { toSeoulDateTime } from "@/lib/calendar";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_TRIES = 5;

// 로그인할 때마다 그날(서울 기준)의 로그인 횟수를 1 올린다(daily_logins, 사용자·날짜별 한 행). 관리자 통계용이다. 트리거·함수·락은 쓰지 않는다.
// 같은 사용자가 같은 순간 두 번 로그인해도 횟수가 사라지지 않도록 '읽은 값이 그대로일 때만 갱신'한다(update ... where count = 읽은 값):
// DB가 행 단위로 이 조건을 원자적으로 확인하므로, 다른 로그인이 먼저 값을 바꿨다면 갱신된 행이 0개이고 그때는 다시 읽고 재시도한다.
// 서로 다른 사용자는 다른 행이라 충돌하지 않는다. 실패해도 로그인은 막지 않는다. 이미 로그인된 채 다시 방문한 것은 세지 않는다.
export async function recordLogin(userId: string | null | undefined) {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const day = toSeoulDateTime(new Date().toISOString()).date;

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const { data, error } = await admin
        .from("daily_logins")
        .select("count")
        .eq("user_id", userId)
        .eq("day", day)
        .maybeSingle();
      if (error) {
        console.error("[login] recordLogin read failed:", error.code ?? "unknown");
        return;
      }

      if (!data) {
        // 오늘 첫 로그인: 행을 만든다. 동시에 다른 로그인이 먼저 만들었다면(중복 오류) 다시 읽어 올리기로 간다.
        const { error: insertError } = await admin.from("daily_logins").insert({ user_id: userId, day, count: 1 });
        if (!insertError) return;
        if (insertError.code !== "23505") {
          console.error("[login] recordLogin insert failed:", insertError.code ?? "unknown");
          return;
        }
        continue;
      }

      // 읽은 값과 같을 때만 올린다. 갱신된 행이 없으면 그 사이 다른 로그인이 올린 것이므로 다시 시도한다.
      const { data: updated, error: updateError } = await admin
        .from("daily_logins")
        .update({ count: data.count + 1 })
        .eq("user_id", userId)
        .eq("day", day)
        .eq("count", data.count)
        .select("count");
      if (updateError) {
        console.error("[login] recordLogin update failed:", updateError.code ?? "unknown");
        return;
      }
      if (updated && updated.length > 0) return;
    }
    console.error("[login] recordLogin gave up after retries");
  } catch {
    console.error("[login] recordLogin threw");
  }
}
