// 사용자 목록 표시용 타입·도우미(서버 전용 코드와 분리해 화면 컴포넌트가 가져올 수 있게 한다).
import type { UserRow, KakaoStatus } from "@/lib/admin/users";
export type { UserRow, KakaoStatus };

const kst = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
// 'YYYY-MM-DD HH:mm'(서울). 값이 없으면 '-'.
const dateTime = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });
export const formatDateTime = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : "-");
export const formatDay = (iso: string | null) => (iso ? kst.format(new Date(iso)) : "-");
