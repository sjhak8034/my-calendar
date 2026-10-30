import { isValidDate, type CalendarDate } from "@/lib/calendar";

// 날짜 → 메모 내용
export type NoteMap = Record<CalendarDate, string>;

// 메모 한 개의 최대 글자 수(DB CHECK와 같다).
export const NOTE_MAX = 1000;
// 사용자당 메모 개수 상한. DB 트리거 대신 서버 코드가 새 메모를 만들 때 확인한다.
export const NOTES_PER_USER_MAX = 2000;

export type NoteError = "invalid" | "tooLong";

// Server Action은 직접 POST로도 호출되므로 날짜와 내용을 서버에서 다시 확인한다.
// 앞뒤 공백을 지운 내용이 비어 있으면 content는 ""(= 메모 삭제)이다.
export function parseNote(
  day: unknown,
  content: unknown,
): { ok: true; day: string; content: string } | { ok: false; error: NoteError } {
  if (typeof day !== "string" || !isValidDate(day) || typeof content !== "string") {
    return { ok: false, error: "invalid" };
  }
  const trimmed = content.trim();
  if (trimmed.length > NOTE_MAX) return { ok: false, error: "tooLong" };
  return { ok: true, day, content: trimmed };
}
