import "server-only";
import { cacheLife } from "next/cache";
import type { CalendarDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import { parseHolidays, type HolidayMap } from "./ics";

export type { Holiday, HolidayKind, HolidayMap } from "./ics";

// 구글 캘린더가 공개한 "대한민국의 휴일"(키 없이 읽는 ics). 영어 화면은 영어 이름 캘린더를 쓴다.
const CALENDAR_ID: Record<Locale, string> = {
  ko: "ko.south_korea#holiday@group.v.calendar.google.com",
  en: "en.south_korea#holiday@group.v.calendar.google.com",
};

const icsUrl = (lang: Locale) =>
  `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID[lang])}/public/basic.ics`;

// 마지막으로 성공한 결과(이 서버 인스턴스 메모리). 새로 받기가 실패했을 때 좋은 캐시를 빈 목록으로 덮어쓰지 않으려고 둔다.
const lastGood: Partial<Record<Locale, HolidayMap>> = {};

// 공개 캘린더 전체(여러 해, 약 100KB)를 한 번 받아 길게 캐시한다. 휴일은 거의 바뀌지 않아 하루에 한 번만 새로 받는다.
// 요청별 데이터(쿠키·세션)는 쓰지 않으므로 모든 사용자가 같은 캐시를 쓴다. 실패하면 직전 성공 값(없으면 빈 목록)을 짧게만 캐시해 곧 다시 시도한다.
async function loadCalendar(lang: Locale): Promise<HolidayMap> {
  "use cache";
  try {
    const res = await fetch(icsUrl(lang), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const map = parseHolidays(await res.text());
    if (Object.keys(map).length === 0) throw new Error("empty");
    lastGood[lang] = map;
    cacheLife({ stale: 3600, revalidate: 86400, expire: 604800 });
    return map;
  } catch (error) {
    // 오류 내용(주소·본문)은 남기지 않고 종류만 남긴다.
    console.error("[holidays] load failed:", error instanceof Error ? error.message.slice(0, 40) : "unknown");
    cacheLife({ stale: 60, revalidate: 300, expire: 600 });
    return lastGood[lang] ?? {};
  }
}

// 화면이 그리는 날짜들이 속한 해의 휴일만 돌려준다(월간은 1~2해, 주간은 1~2해).
// 구글 파일은 여러 해가 한 파일이라 전체를 한 번 캐시하고 여기서 해별로 걸러낸다.
export async function getHolidaysForDates(
  dates: readonly CalendarDate[],
  lang: Locale,
): Promise<HolidayMap> {
  const years = new Set(dates.map((date) => date.slice(0, 4)));
  const all = await loadCalendar(lang);
  const out: HolidayMap = {};
  for (const [date, holiday] of Object.entries(all)) {
    if (years.has(date.slice(0, 4))) out[date as CalendarDate] = holiday;
  }
  return out;
}
