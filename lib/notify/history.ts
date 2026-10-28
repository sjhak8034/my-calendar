import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotificationRecord = {
  id: string;
  kind: "start" | "end";
  channel: "web_push" | "kakao";
  status: string;
  error: string | null;
  sendAt: string;
  title: string;
};

// 설정 화면의 "최근 알림 발송 상태". 아직 보낼 때가 안 된 대기(pending) 알림은 빼고 본인 것만(RLS) 돌려준다.
export async function getRecentNotifications(limit = 10): Promise<NotificationRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, channel, status, error, send_at, events(title)")
    .neq("status", "pending")
    .order("send_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[notify] getRecentNotifications failed:", error.message);
    return [];
  }
  return data.map((row) => {
    // 일정과의 관계는 다대일이라 객체로 오지만, 배열로 와도 첫 번째를 쓴다.
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    return {
      id: row.id,
      kind: row.kind,
      channel: row.channel,
      status: row.status,
      error: row.error,
      sendAt: row.send_at,
      title: event?.title ?? "",
    };
  });
}
