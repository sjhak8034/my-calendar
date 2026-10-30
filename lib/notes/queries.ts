import "server-only";
import type { CalendarDate } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import type { NoteMap } from "./input";

// startDate~endDate(포함) 사이의 내 메모. RLS가 본인 메모만 돌려준다.
// 메모는 보조 기능이라 읽기에 실패해도(예: 아직 마이그레이션 전) 일정 화면은 그대로 보여 준다.
// 다만 "메모 없음"과 "못 읽음"을 구분해(failed) 돌려준다: 못 읽은 채로 빈 입력칸에 저장하면 있던 메모를 덮어쓰기 때문이다.
export async function getNotesForRange(
  startDate: CalendarDate,
  endDate: CalendarDate,
): Promise<{ notes: NoteMap; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_notes")
    .select("day, content")
    .gte("day", startDate)
    .lte("day", endDate)
    .limit(100);
  if (error) {
    console.error("[notes] load failed:", error.code ?? "unknown");
    return { notes: {}, failed: true };
  }
  const notes: NoteMap = {};
  for (const row of data ?? []) notes[row.day as CalendarDate] = row.content as string;
  return { notes, failed: false };
}
