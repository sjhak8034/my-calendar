import type { CalendarDate } from "@/lib/calendar";

// 쉬는 날(공휴일·대체공휴일)과 쉬지 않는 기념일(어버이날 등)을 구분한다.
export type HolidayKind = "holiday" | "observance";
export type Holiday = { name: string; kind: HolidayKind };
export type HolidayMap = Record<CalendarDate, Holiday>;

// 구글 캘린더 ics의 DESCRIPTION 첫 줄: 한국어 "공휴일"/"기념일", 영어 "Public holiday"/"Observance".
function kindOf(description: string): HolidayKind | null {
  const head = description.split(/\\n|\n/)[0].trim().toLowerCase();
  if (head === "공휴일" || head === "public holiday") return "holiday";
  if (head === "기념일" || head === "observance") return "observance";
  return null;
}

// ics 텍스트 값의 이스케이프(\, \; \\ \n)를 푼다.
const unescapeText = (value: string) =>
  value.replace(/\\([,;\\nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

const ymd = (raw: string): CalendarDate | null => {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  return m ? (`${m[1]}-${m[2]}-${m[3]}` as CalendarDate) : null;
};

// 다음 날(UTC 기준 날짜 연산이라 시간대 영향이 없다).
function addDay(date: CalendarDate): CalendarDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) as CalendarDate;
}

// 한 날짜에 둘 이상이면 쉬는 날을 우선한다(같은 종류면 먼저 나온 이름을 둔다).
function put(map: HolidayMap, date: CalendarDate, next: Holiday) {
  const current = map[date];
  if (!current || (current.kind === "observance" && next.kind === "holiday")) map[date] = next;
}

// 구글 공개 캘린더(.ics)를 날짜별 휴일로 바꾼다. 날짜 형식이 아니거나 종류를 모르는 항목은 건너뛴다.
export function parseHolidays(ics: string): HolidayMap {
  const map: HolidayMap = {};
  // 긴 줄은 다음 줄 첫 칸이 공백/탭으로 이어진다(RFC 5545 줄 펼치기).
  const text = ics.replace(/\r?\n[ \t]/g, "");
  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const field = (key: string) =>
      new RegExp(`^${key}(?:;[^:\\r\\n]*)?:(.*?)\\r?$`, "m").exec(body)?.[1] ?? "";
    const start = ymd(field("DTSTART"));
    const kind = kindOf(unescapeText(field("DESCRIPTION")));
    const name = unescapeText(field("SUMMARY")).trim();
    if (!start || !kind || !name) continue;
    // DTEND는 마지막 날의 다음 날(배타). 없으면 하루짜리.
    const end = ymd(field("DTEND")) ?? addDay(start);
    for (let day = start, guard = 0; day < end && guard < 31; day = addDay(day), guard += 1) {
      put(map, day, { name, kind });
    }
  }
  return map;
}
