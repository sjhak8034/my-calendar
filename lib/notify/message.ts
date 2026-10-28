import "server-only";
import { fillTemplate, formatTimeRange, toSeoulDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { DueNotification } from "./dispatch";

// 채널(웹 푸시·카카오톡)이 함께 쓰는 알림 문구. url은 앱 안의 경로다(카카오는 SITE_URL을 앞에 붙인다).
export type NotificationMessage = { title: string; body: string; url: string; tag: string };

export async function notificationMessage(n: DueNotification, lang: Locale): Promise<NotificationMessage> {
  const { notify } = await getDictionary(lang);
  const range = formatTimeRange(n.start_at, n.end_at, lang);
  return {
    title: n.title,
    body: fillTemplate(n.kind === "start" ? notify.startBody : notify.endBody, { range }),
    url: `/${lang}/day/${toSeoulDate(n.start_at)}`,
    tag: n.id,
  };
}
