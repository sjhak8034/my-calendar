import { formatShortDate, formatTime, toSeoulDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { NotificationRecord } from "@/lib/notify/history";

type Dict = Dictionary["settings"]["history"];

const STATUS_CLASS: Record<string, string> = {
  sent: "text-foreground",
  failed: "text-destructive",
  skipped: "text-muted-foreground",
  sending: "text-muted-foreground",
};

// 상태 코드를 사용자용 문구로 바꾼다. 모르는 실패 사유는 일반 문구로 보여 주고, 건너뜀·발송됨은 사유를 생략한다.
function reasonText(record: NotificationRecord, dict: Dict): string | null {
  if (!record.error) return null;
  const known = (dict.reasons as Record<string, string>)[record.error];
  if (known) return known;
  return record.status === "failed" ? dict.reasonOther : null;
}

// 설정 화면의 "최근 알림 발송" 목록(채널·종류·상태·시각)
export function NotificationHistory({ lang, dict, records }: { lang: Locale; dict: Dict; records: NotificationRecord[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold">{dict.title}</h2>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {records.map((record) => {
            const reason = reasonText(record, dict);
            const statusLabel = (dict.status as Record<string, string>)[record.status] ?? record.status;
            return (
              <li key={record.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">{record.title || dict.untitled}</span>
                  <span className={`shrink-0 text-xs font-medium ${STATUS_CLASS[record.status] ?? ""}`}>{statusLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {dict.kind[record.kind]} · {dict.channel[record.channel]} ·{" "}
                  <time dateTime={record.sendAt}>
                    {formatShortDate(toSeoulDate(record.sendAt))} {formatTime(record.sendAt, lang)}
                  </time>
                  {reason && <> · {reason}</>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
