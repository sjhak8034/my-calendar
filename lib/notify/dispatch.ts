import "server-only";
import { dispatchWebPush } from "./web-push";

// claim_due_notifications가 돌려주는 선점된 알림 한 건
export type DueNotification = {
  id: string;
  user_id: string;
  event_id: string;
  kind: "start" | "end";
  channel: "web_push" | "kakao";
  send_at: string;
  title: string;
  start_at: string;
  end_at: string;
};

export type DispatchResult =
  | { status: "sent" }
  | { status: "skipped"; error: string } // 보내지 않음(채널 미연결·미구현 등). 실패가 아니다.
  | { status: "failed"; error: string };

// 채널별 발송. 카카오톡은 Task 012에서 구현하며, 그 전까지는 보내지 않고 skipped로 닫는다.
export async function dispatchNotification(n: DueNotification): Promise<DispatchResult> {
  switch (n.channel) {
    case "web_push":
      return dispatchWebPush(n);
    case "kakao":
      return { status: "skipped", error: "channel_not_ready" };
  }
}
