"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";
import { NOTES_PER_USER_MAX, parseNote, type NoteError } from "./input";

export type NoteResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "limit" | "failed" | NoteError };

// 메모가 바뀌면 메모 아이콘이 있는 주간·월간 페이지만 다시 그린다(일정 액션과 같은 방식).
function refreshCalendar() {
  revalidatePath("/[lang]/day/[date]", "page");
  revalidatePath("/[lang]", "page");
}

// 날짜별 메모 저장. 내용을 비우면 메모를 지운다. 본인 메모만 다루는 것은 RLS가 보장한다.
export async function saveDayNote(day: unknown, content: unknown): Promise<NoteResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  const parsed = parseNote(day, content);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const { supabase, user } = session;

  if (parsed.content === "") {
    const { error } = await supabase
      .from("day_notes")
      .delete()
      .eq("user_id", user.id)
      .eq("day", parsed.day);
    if (error) {
      console.error("[notes] delete failed:", error.code ?? "unknown");
      return { ok: false, code: "failed" };
    }
    refreshCalendar();
    return { ok: true };
  }

  // 이미 있는 날짜의 수정이 대부분이라 먼저 갱신해 본다(한 번의 요청으로 끝난다). 갱신된 행이 없을 때만 새 메모다.
  const updatedAt = new Date().toISOString();
  const update = () =>
    supabase
      .from("day_notes")
      .update({ content: parsed.content, updated_at: updatedAt })
      .eq("user_id", user.id)
      .eq("day", parsed.day)
      .select("day");
  const updated = await update();
  if (updated.error) {
    console.error("[notes] update failed:", updated.error.code ?? "unknown");
    return { ok: false, code: "failed" };
  }
  if (updated.data.length === 0) {
    // 새 메모: 개수 상한을 확인한다. 확인과 저장이 따로라 동시에 여러 요청이 오면 조금 넘을 수 있다(트리거를 쓰지 않기로 한 대가).
    const total = await supabase.from("day_notes").select("day", { head: true, count: "exact" });
    if (total.error) {
      console.error("[notes] count failed:", total.error.code ?? "unknown");
      return { ok: false, code: "failed" };
    }
    if ((total.count ?? 0) >= NOTES_PER_USER_MAX) return { ok: false, code: "limit" };

    const inserted = await supabase
      .from("day_notes")
      .insert({ user_id: user.id, day: parsed.day, content: parsed.content, updated_at: updatedAt });
    if (inserted.error) {
      // 같은 날짜의 새 메모가 동시에 들어온 경우(중복 키): 방금 들어온 메모를 이 내용으로 갱신한다.
      if (inserted.error.code === "23505") {
        const retry = await update();
        if (!retry.error && retry.data.length > 0) {
          refreshCalendar();
          return { ok: true };
        }
      }
      console.error("[notes] save failed:", inserted.error.code ?? "unknown");
      return { ok: false, code: "failed" };
    }
  }
  refreshCalendar();
  return { ok: true };
}
