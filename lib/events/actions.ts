"use server";

import { revalidatePath } from "next/cache";
import { requireUser as requireSessionUser } from "@/lib/supabase/require-user";
import {
  isEventInput,
  parseMoveRange,
  rangeToIso,
  toPayload,
  type EventErrors,
  type EventInput,
} from "./input";
import type { DayRange } from "@/lib/calendar";

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      code: "unauthorized" | "validation" | "notFound" | "failed";
      errors?: EventErrors;
    };

// 일정이 바뀌면 그 일정을 보여 주는 주간·월간 페이지만 다시 그린다.
// 레이아웃(사이드바의 사용자 조회 등)까지 무효화하는 것보다 서버 작업이 적다.
// (Next.js 문서상 Server Function의 revalidatePath는 지금은 이전에 방문한 다른 페이지도 다시 가져오는 임시 동작이 있다.)
function refreshCalendar() {
  revalidatePath("/[lang]/day/[date]", "page");
  revalidatePath("/[lang]", "page");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server Action은 직접 POST로도 호출되므로 매번 로그인과 입력을 서버에서 확인한다.
// 본인 일정만 다루는 것은 RLS가 보장한다(user_id는 auth.uid() 기본값).
async function requireUser() {
  return (await requireSessionUser())?.supabase ?? null;
}

// 알림 예약은 DB 트리거(events_schedule_notifications)가 일정 저장·시각 수정 때 처리한다. 삭제는 FK cascade.
export async function createEvent(input: EventInput): Promise<ActionResult> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, code: "unauthorized" };
  if (!isEventInput(input)) return { ok: false, code: "validation" };

  const parsed = toPayload(input);
  if (!parsed.ok) return { ok: false, code: "validation", errors: parsed.errors };

  const { error } = await supabase.from("events").insert(parsed.payload);
  if (error) {
    console.error("[events] createEvent failed:", error.message);
    return { ok: false, code: "failed" };
  }
  refreshCalendar();
  return { ok: true };
}

export async function updateEvent(
  id: string,
  input: EventInput,
): Promise<ActionResult> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, code: "unauthorized" };
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return { ok: false, code: "notFound" };
  if (!isEventInput(input)) return { ok: false, code: "validation" };

  const parsed = toPayload(input);
  if (!parsed.ok) return { ok: false, code: "validation", errors: parsed.errors };

  // RLS가 남의 일정을 걸러 내므로 영향 행이 없으면 없는 일정으로 본다.
  const { data, error } = await supabase
    .from("events")
    .update(parsed.payload)
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[events] updateEvent failed:", error.message);
    return { ok: false, code: "failed" };
  }
  if (data.length === 0) return { ok: false, code: "notFound" };
  refreshCalendar();
  return { ok: true };
}

// 드래그로 시간만 옮기거나 늘릴 때: 시작·종료 시각만 갱신한다(제목 등 다른 필드는 건드리지 않는다).
export async function moveEvent(id: string, range: DayRange): Promise<ActionResult> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, code: "unauthorized" };
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return { ok: false, code: "notFound" };
  const parsed = parseMoveRange(range);
  if (!parsed) return { ok: false, code: "validation" };

  const { data, error } = await supabase
    .from("events")
    .update(rangeToIso(parsed))
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[events] moveEvent failed:", error.message);
    return { ok: false, code: "failed" };
  }
  if (data.length === 0) return { ok: false, code: "notFound" };
  refreshCalendar();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const supabase = await requireUser();
  if (!supabase) return { ok: false, code: "unauthorized" };
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return { ok: false, code: "notFound" };

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[events] deleteEvent failed:", error.message);
    return { ok: false, code: "failed" };
  }
  if (data.length === 0) return { ok: false, code: "notFound" };
  refreshCalendar();
  return { ok: true };
}
