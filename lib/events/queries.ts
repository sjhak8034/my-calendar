import "server-only";
import { addDays, type CalendarDate } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

export type CalendarEvent = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string | null;
};

export type EventsResult =
  | { ok: true; events: CalendarEvent[]; truncated?: boolean }
  | { ok: false };

// 현대 기준(과거 일광절약시간 구간 제외)으로 서울은 +09:00 고정 오프셋을 쓴다.
const SEOUL_OFFSET = "+09:00";

// PostgREST 기본 행 수 제한으로 조용히 잘리지 않도록 명시하는 상한.
const MAX_EVENTS = 2000;

// startDate 00:00 ~ endDate 다음 날 00:00(미포함) 사이와 겹치는 일정.
// RLS가 본인 일정만 돌려주므로 user_id 조건은 두지 않는다.
export async function getEventsForRange(
  startDate: CalendarDate,
  endDate: CalendarDate,
): Promise<EventsResult> {
  const rangeStart = `${startDate}T00:00:00${SEOUL_OFFSET}`;
  const rangeEnd = `${addDays(endDate, 1)}T00:00:00${SEOUL_OFFSET}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, start_at, end_at, all_day, color")
    .lt("start_at", rangeEnd)
    .gte("end_at", rangeStart)
    .order("start_at", { ascending: true })
    .limit(MAX_EVENTS);

  if (error) {
    // 내부 오류 내용은 화면에 노출하지 않고 서버 로그에만 남긴다.
    console.error("[events] getEventsForRange failed:", error.message);
    return { ok: false };
  }
  return { ok: true, events: data, truncated: data.length >= MAX_EVENTS };
}
