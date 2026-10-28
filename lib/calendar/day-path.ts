import { isValidDate, parseDate } from "./date";
import { CALENDAR_MAX_YEAR, CALENDAR_MIN_YEAR } from "./month-grid";

const DAY_PATH = /^\/day\/([^/]+)\/?$/;

// 언어 접두사를 뺀 경로가 /day/<날짜> 모양인데 날짜가 잘못됐는지(형식·존재하지 않는 날짜·달력 연도 범위 밖).
// 날짜 화면은 Suspense 안에서 notFound()를 불러 HTTP 200으로 나가므로, proxy.ts가 이 함수로 먼저 걸러 404로 보낸다.
// 순수 함수라 proxy에서 불러도 현재 시각을 읽지 않는다.
// 퍼센트 인코딩 자체가 깨진 경로(/day/%ZZ)는 false로 두어 Next.js의 기본 처리에 맡긴다(rewrite하면 Next.js가 500을 낸다).
export function isInvalidDayPath(subPath: string): boolean {
  const match = DAY_PATH.exec(subPath);
  if (!match) return false;
  let date: string;
  try {
    date = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  if (!isValidDate(date)) return true;
  const parts = parseDate(date);
  return !parts || parts.year < CALENDAR_MIN_YEAR || parts.year > CALENDAR_MAX_YEAR;
}
