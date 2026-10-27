"use server";

import { requireUser } from "@/lib/supabase/require-user";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type LatestResult =
  | { ok: true; conversationId: string | null; messages: StoredMessage[] }
  | { ok: false; code: "unauthorized" | "failed" };

// 가장 최근에 대화한 본인 대화(만료분은 RLS가 숨긴다)와 그 메시지. 대화가 없으면 conversationId가 null이다.
export async function loadLatestConversation(): Promise<LatestResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  const { supabase } = session;

  const { data: conversation, error } = await supabase
    .from("ai_conversations")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[ai] loadLatestConversation failed:", error.message);
    return { ok: false, code: "failed" };
  }
  if (!conversation) return { ok: true, conversationId: null, messages: [] };

  // 최근 메시지 500개를 시간순으로 돌려준다.
  const { data: messages, error: messagesError } = await supabase
    .from("ai_messages")
    .select("id, role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (messagesError) {
    console.error("[ai] loadLatestConversation messages failed:", messagesError.message);
    return { ok: false, code: "failed" };
  }
  return {
    ok: true,
    conversationId: conversation.id as string,
    messages: (messages as StoredMessage[]).reverse(),
  };
}

export type DeleteResult = { ok: true } | { ok: false; code: "unauthorized" | "failed" };

// 메시지는 대화 삭제의 cascade로 함께 지워진다. RLS가 남의 대화를 걸러 낸다.
export async function deleteAllConversations(): Promise<DeleteResult> {
  const session = await requireUser();
  if (!session) return { ok: false, code: "unauthorized" };
  const { error } = await session.supabase
    .from("ai_conversations")
    .delete()
    .not("id", "is", null);
  if (error) {
    console.error("[ai] deleteAllConversations failed:", error.message);
    return { ok: false, code: "failed" };
  }
  return { ok: true };
}
