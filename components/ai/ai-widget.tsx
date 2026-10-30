"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, Plus, Send, Square, Trash2, X } from "lucide-react";
import { DOT_CLASS } from "@/components/calendar/event-colors";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteAllConversations, loadLatestConversation } from "@/lib/ai/actions";
import { AI_MAX_QUESTION_CHARS } from "@/lib/ai/limits";
import { normalizeEventColor } from "@/lib/calendar";
import type { AiDraft } from "@/lib/ai/draft";
import { createEvent, deleteEvent, updateEvent } from "@/lib/events/actions";
import type { EventInput } from "@/lib/events/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

type Labels = Dictionary["ai"];
type ErrorKey = keyof Labels["errors"];
type DraftStatus = "pending" | "saving" | "saved" | "cancelled" | "failed";
type Draft = { key: string; draft: AiDraft; status: DraftStatus };
type Msg = { key: string; role: "user" | "assistant"; content: string; drafts?: Draft[] };

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));

const isErrorKey = (code: unknown, labels: Labels): code is ErrorKey =>
  typeof code === "string" && code in labels.errors;

// 서버가 줄 단위 JSON(NDJSON)으로 보내는 스트림 이벤트
type StreamEvent =
  | { t: "meta"; conversationId: string }
  | { t: "tool"; name: string }
  | { t: "draft"; draft: AiDraft }
  | { t: "delta"; v: string }
  | { t: "error"; code: string }
  | { t: "done"; finish: string };

const POS_KEY = "ai-button-pos";
const DRAG_THRESHOLD = 5; // 이만큼(px) 움직여야 끌기로 본다: 그보다 작으면 그냥 누르기(열기·닫기)

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// 저장해 둔 위치(화면 안의 비율 0~1)를 버튼에 적용한다. 비율로 저장해야 휴대폰·PC처럼 화면 크기가 달라도 화면 밖으로 나가지 않는다.
function placeButton(el: HTMLElement, rx: number, ry: number) {
  const maxX = Math.max(0, document.documentElement.clientWidth - el.offsetWidth);
  const maxY = Math.max(0, window.innerHeight - el.offsetHeight);
  el.style.left = `${clamp01(rx) * maxX}px`;
  el.style.top = `${clamp01(ry) * maxY}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
}

function readSavedPosition(): { rx: number; ry: number } | null {
  try {
    const value = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    if (value && Number.isFinite(value.rx) && Number.isFinite(value.ry)) return value;
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 기본 위치를 쓴다.
  }
  return null;
}

// 오른쪽 아래 둥근 버튼과, 누르면 열리는 채팅 팝업. 앱 공통 레이아웃에 한 번만 둔다.
// 버튼 아이콘은 나중에 받을 이미지로 교체한다(아래 ToggleIcon 한 곳만 바꾸면 된다).
export function AiWidget({ lang, labels }: { lang: Locale; labels: Labels }) {
  const [open, setOpen] = useState(false);
  // 팝업을 닫아도 답변 스트림과 대화가 유지되도록, 한 번 열린 뒤에는 계속 마운트해 둔다.
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // 끌어서 옮긴 위치. 기본 위치(null)는 CSS가 정하고, 옮긴 뒤에는 버튼의 style(left/top)로 덮어쓴다.
  // 직접 DOM에 쓰는 이유: 끄는 동안 매 움직임마다 다시 그리지 않고, React가 그리는 style과 겹치지 않게 하려는 것이다.
  const position = useRef<{ rx: number; ry: number } | null>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;
    position.current = readSavedPosition();
    if (position.current) placeButton(el, position.current.rx, position.current.ry);
    const onResize = () => {
      if (position.current) placeButton(el, position.current.rx, position.current.ry);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    // 처음부터 포인터를 붙잡아야 빠르게 끌어 버튼 밖으로 나가도 움직임을 계속 받는다.
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    const el = buttonRef.current;
    if (!d || !el || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
    }
    const maxX = Math.max(0, document.documentElement.clientWidth - el.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - el.offsetHeight);
    const left = Math.min(maxX, Math.max(0, d.left + dx));
    const top = Math.min(maxY, Math.max(0, d.top + dy));
    position.current = { rx: maxX ? left / maxX : 0, ry: maxY ? top / maxY : 0 };
    placeButton(el, position.current.rx, position.current.ry);
  }

  function onPointerEnd(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    // 끌고 놓은 뒤에 따라오는 click은 열기·닫기로 처리하지 않는다.
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(position.current));
    } catch {
      // 저장하지 못해도 이번 방문에서는 옮긴 위치가 유지된다.
    }
  }

  function toggle(next: boolean) {
    if (next && !mounted) {
      // 처음 열 때는 닫힌 모습으로 먼저 그린 뒤 열어야 열리는 애니메이션이 재생된다.
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
      return;
    }
    setOpen(next);
    if (!next) buttonRef.current?.focus();
  }

  return (
    <>
      {mounted && <ChatPanel lang={lang} labels={labels} open={open} onClose={() => toggle(false)} />}
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        aria-controls="ai-chat-panel"
        onClick={() => {
          if (!suppressClick.current) toggle(!open);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={cn(
          // 터치로 끌 때 화면이 스크롤되지 않게 한다(이 버튼 위에서만).
          "touch-none",
          // 휴대폰(sm 미만): 오른쪽 아래에 두면 주간 그리드 버튼을 가리므로 상단 바의 빈 공간(로고와 메뉴 버튼 사이, 메뉴 버튼 왼쪽)에 작게 둔다.
          // sm 이상: 오른쪽 아래 둥근 버튼.
          "fixed top-2.5 right-[3.75rem] z-50 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg outline-none transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:[&_svg]:size-5 sm:top-auto sm:right-6 sm:bottom-6 sm:size-14",
          // 일정 입력창(아래 시트·오른쪽 사이드바)이 열려 있는 동안은 버튼이 그 위(저장 버튼 등)를 가리지 않게 숨긴다. 끌어서 옮긴 위치에서도 같다.
          "[body:has([data-slot=event-side-panel])_&]:hidden",
          // 작은 화면에서는 팝업이 전체 화면이므로 열려 있는 동안 버튼은 숨긴다(닫기는 팝업의 X).
          open && "max-sm:hidden",
        )}
      >
        {/* 아이콘이 바뀔 때 살짝 돌며 나타난다(key가 달라 다시 마운트되면서 재생) */}
        {open ? (
          <X key="close" className="size-6 animate-in spin-in-90 duration-300" aria-hidden="true" />
        ) : (
          <span key="open" className="animate-in zoom-in-50 duration-300">
            <ToggleIcon />
          </span>
        )}
      </button>
    </>
  );
}

// TODO: 제공받은 아이콘으로 교체
function ToggleIcon() {
  return <MessageCircle className="size-6" aria-hidden="true" />;
}

function ChatPanel({
  lang,
  labels,
  open,
  onClose,
}: {
  lang: Locale;
  labels: Labels;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [working, setWorking] = useState<"search" | "draft" | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const touchedRef = useRef(false); // 불러오는 동안 사용자가 이미 대화를 시작했는지
  // 받은 글자를 바로 붙이지 않고 큐에 쌓아 한 글자씩 보여 준다.
  const queueRef = useRef("");
  const timerRef = useRef<number | null>(null);

  function appendToLast(text: string) {
    setMessages((all) => {
      const next = all.slice();
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, content: last.content + text };
      return next;
    });
  }

  function stopTyping() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  // 큐에 남은 글자를 한꺼번에 보여 준다(중단·움직임 줄이기 설정).
  function flushQueue() {
    stopTyping();
    const rest = queueRef.current;
    queueRef.current = "";
    if (rest) appendToLast(rest);
  }

  // 큐에서 한 번에 한 글자(밀리면 따라잡도록 조금 더)를 꺼낸다.
  function tick() {
    const queue = queueRef.current;
    if (!queue) return stopTyping();
    let n = Math.max(1, Math.ceil(queue.length / 40));
    const code = queue.charCodeAt(n - 1);
    if (code >= 0xd800 && code <= 0xdbff) n += 1; // 이모지 등 서로게이트 쌍을 가르지 않는다.
    queueRef.current = queue.slice(n);
    appendToLast(queue.slice(0, n));
  }

  function enqueue(text: string) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return appendToLast(text);
    queueRef.current += text;
    if (timerRef.current === null) timerRef.current = window.setInterval(tick, 25);
  }

  // 큐가 빌 때까지 기다린다. 중단되면 바로 끝낸다.
  function drainQueue(signal: AbortSignal) {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!queueRef.current || signal.aborted) resolve();
        else window.setTimeout(check, 30);
      };
      check();
    });
  }

  // 처음 열릴 때 가장 최근 대화를 불러와 이어서 보여 준다.
  useEffect(() => {
    let cancelled = false;
    loadLatestConversation()
      .catch(() => null)
      .then((result) => {
        if (cancelled || touchedRef.current) return;
        if (result?.ok) {
          setConversationId(result.conversationId);
          setMessages(result.messages.map((m) => ({ key: m.id, role: m.role, content: m.content })));
        } else if (result) {
          setError(result.code);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, working]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    },
    [],
  );

  // 일정 변경안 카드를 지금 답변 말풍선에 붙인다.
  function addDraft(change: AiDraft) {
    const draft: Draft = { key: `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`, draft: change, status: "pending" };
    setMessages((all) => {
      const next = all.slice();
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, drafts: [...(last.drafts ?? []), draft] };
      return next;
    });
  }

  function setDraftStatus(key: string, status: DraftStatus) {
    setMessages((all) =>
      all.map((m) =>
        m.drafts?.some((d) => d.key === key)
          ? { ...m, drafts: m.drafts.map((d) => (d.key === key ? { ...d, status } : d)) }
          : m,
      ),
    );
  }

  // 사용자가 버튼을 눌러야만 실행한다. 직접 편집과 같은 Server Action(로그인·입력 검증·RLS 포함)이 처리한다.
  async function confirmDraft(draft: Draft) {
    if (draft.status !== "pending" && draft.status !== "failed") return;
    setDraftStatus(draft.key, "saving");
    const change = draft.draft;
    const result = await (
      change.kind === "create"
        ? createEvent(change.input)
        : change.kind === "update"
          ? updateEvent(change.id, change.input)
          : deleteEvent(change.id)
    ).catch(() => null);
    setDraftStatus(draft.key, result?.ok ? "saved" : "failed");
  }

  function resetChat() {
    abortRef.current?.abort();
    stopTyping();
    queueRef.current = "";
    touchedRef.current = true;
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
    setNotice(null);
    setConfirmAll(false);
    inputRef.current?.focus();
  }

  function handleEvent(event: StreamEvent) {
    if (event.t === "meta") {
      setConversationId(event.conversationId);
    } else if (event.t === "tool") {
      setWorking(event.name === "search_events" ? "search" : "draft");
    } else if (event.t === "draft") {
      setWorking(null);
      addDraft(event.draft);
    } else if (event.t === "delta") {
      setWorking(null);
      enqueue(event.v);
    } else if (event.t === "error") {
      setError(isErrorKey(event.code, labels) ? event.code : "upstream");
    } else if (event.finish === "length") {
      setNotice((prev) => prev ?? labels.notices.cut);
    }
  }

  async function send() {
    const text = question.trim();
    if (!text || streaming) return;
    touchedRef.current = true;
    setError(null);
    setNotice(null);
    setConfirmAll(false);
    const controller = new AbortController();
    abortRef.current = controller;
    const stamp = Date.now();
    setMessages((all) => [
      ...all,
      { key: `u${stamp}`, role: "user", content: text },
      { key: `a${stamp}`, role: "assistant", content: "" },
    ]);
    setQuestion("");
    setStreaming(true);

    // 답변이 시작되기 전에 실패하면 방금 추가한 두 말풍선을 걷고 질문을 되돌려 놓는다.
    const rollback = (code: ErrorKey) => {
      setMessages((all) => all.slice(0, -2));
      setQuestion(text);
      setError(code);
    };

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, conversationId, lang }),
        signal: controller.signal,
      });
      if (response.status === 401) {
        // 세션이 만료됐다. fetch는 이동하지 않으므로 직접 로그인 화면으로 보낸다.
        router.push(`/${lang}/login`);
        return;
      }
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        rollback(isErrorKey(body?.code, labels) ? body.code : "failed");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rest = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const lines = (rest + decoder.decode(value, { stream: true })).split("\n");
        rest = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          try {
            handleEvent(JSON.parse(line) as StreamEvent);
          } catch {
            // 깨진 줄은 무시한다.
          }
        }
      }
      // 스트림이 끝나도 큐에 남은 글자가 다 보일 때까지 기다린다(그동안은 중단 버튼이 남는다).
      await drainQueue(controller.signal);
      if (controller.signal.aborted) flushQueue();
    } catch {
      flushQueue(); // 받은 만큼은 남긴다(타자 효과가 다른 말풍선에 이어지지 않게 먼저 비운다).
      if (controller.signal.aborted) {
        // 중단: 비어 있는 답변 말풍선만 걷는다.
        setMessages((all) => (all[all.length - 1]?.content === "" ? all.slice(0, -1) : all));
      } else {
        setMessages((all) => {
          if (all[all.length - 1]?.content === "") {
            setQuestion(text);
            return all.slice(0, -2);
          }
          return all;
        });
        setError("network");
      }
    } finally {
      setStreaming(false);
      setWorking(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function removeAll() {
    setConfirmAll(false);
    const result = await deleteAllConversations().catch(() => null);
    if (result?.ok) resetChat();
    else setError("failed");
  }

  const last = messages[messages.length - 1];
  const waiting = streaming && last?.role === "assistant" && last.content === "" && !last.drafts?.length;

  return (
    <section
      id="ai-chat-panel"
      role="dialog"
      aria-label={labels.title}
      aria-hidden={!open}
      inert={!open}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden border bg-card text-card-foreground shadow-2xl",
        // 작은 화면: 전체 화면. sm 이상: 버튼 위의 팝업.
        "inset-0 sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(36rem,calc(100dvh-7.5rem))] sm:w-[24rem] sm:rounded-2xl",
        // 열고 닫을 때: 흐려지지 않고 버튼 쪽(휴대폰은 오른쪽 위, sm 이상은 오른쪽 아래)에서 작아졌다 커진다.
        // visibility도 함께 전환해 닫는 애니메이션이 끝난 뒤에 숨겨지고 포커스도 받지 않는다.
        // Tailwind v4의 scale-*은 transform이 아닌 scale 속성이라 전환 대상에 scale을 직접 적어야 한다.
        "origin-top-right transition-[scale,visibility] duration-300 ease-out motion-reduce:transition-none sm:origin-bottom-right",
        open ? "visible scale-100" : "invisible scale-0",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{labels.title}</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetChat}
            disabled={messages.length === 0 && !streaming}
          >
            <Plus aria-hidden="true" />
            {labels.newChat}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={labels.deleteAll}
            aria-expanded={confirmAll}
            onClick={() => setConfirmAll((v) => !v)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.close} onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>

      {confirmAll && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-destructive/5 px-4 py-3">
          <p role="alert" className="min-w-0 flex-1 basis-full text-sm text-destructive">
            {labels.deleteAllConfirm}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmAll(false)}>
            {labels.cancel}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => void removeAll()}>
            {labels.deleteAllYes}
          </Button>
        </div>
      )}

      <div
        role="log"
        aria-live="polite"
        aria-label={labels.messagesLabel}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {loading ? (
          <p className="m-auto text-sm text-muted-foreground">{labels.loading}</p>
        ) : messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-1 text-center">
            <p className="font-medium">{labels.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{labels.emptyHint}</p>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "assistant" && m.content === "" && !m.drafts?.length ? null : (
              <div
                key={m.key}
                className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}
              >
                <span className="text-xs text-muted-foreground">
                  {m.role === "user" ? labels.roleUser : labels.roleAssistant}
                </span>
                {m.content !== "" && (
                  <p
                    className={cn(
                      "max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    {m.content}
                  </p>
                )}
                {m.drafts?.map((d) => (
                  <DraftCard
                    key={d.key}
                    draft={d}
                    lang={lang}
                    labels={labels}
                    onConfirm={() => void confirmDraft(d)}
                    onCancel={() => setDraftStatus(d.key, "cancelled")}
                  />
                ))}
              </div>
            ),
          )
        )}
        {(waiting || working) && (
          <p className="text-sm text-muted-foreground">
            {working === "search" ? labels.searching : working === "draft" ? labels.drafting : labels.answering}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {(notice || error) && (
        <div className="flex flex-col gap-1 px-4 pb-2">
          {notice && (
            <p role="status" className="text-xs text-muted-foreground">
              {notice}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {labels.errors[error]}
            </p>
          )}
        </div>
      )}

      <form
        className="flex flex-col gap-2 border-t px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Textarea
          ref={inputRef}
          rows={2}
          aria-label={labels.inputLabel}
          value={question}
          maxLength={AI_MAX_QUESTION_CHARS}
          placeholder={labels.placeholder}
          disabled={streaming}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            // 한글 조합 중 Enter는 글자 확정이므로 전송하지 않는다.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          className="max-h-32 min-h-0 resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            {fill(labels.counter, { count: question.length, max: AI_MAX_QUESTION_CHARS })}
          </span>
          {streaming ? (
            <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
              <Square aria-hidden="true" />
              {labels.stop}
            </Button>
          ) : (
            <Button type="submit" size="sm" disabled={!question.trim() || loading}>
              <Send aria-hidden="true" />
              {labels.send}
            </Button>
          )}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">{labels.disclaimer}</p>
      </form>
    </section>
  );
}

// 일시 표시 문구
function dateText(input: EventInput): string {
  if (input.allDay) {
    return input.startDate === input.endDate ? input.startDate : `${input.startDate} ~ ${input.endDate}`;
  }
  return input.startDate === input.endDate
    ? `${input.startDate} ${input.startTime} ~ ${input.endTime}`
    : `${input.startDate} ${input.startTime} ~ ${input.endDate} ${input.endTime}`;
}

function EventSummary({ input, labels, muted }: { input: EventInput; labels: Labels; muted?: boolean }) {
  return (
    <div className={cn("flex items-start gap-2", muted && "text-muted-foreground")}>
      <span
        aria-hidden="true"
        className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT_CLASS[normalizeEventColor(input.color)])}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{input.title}</p>
        <p className="text-xs text-muted-foreground">
          {dateText(input)}
          {input.allDay && ` · ${labels.draft.allDay}`}
        </p>
        {input.description && (
          <p className="mt-1 line-clamp-3 text-xs break-words whitespace-pre-wrap text-muted-foreground">
            {input.description}
          </p>
        )}
      </div>
    </div>
  );
}

// AI가 만든 일정 변경안(추가·수정·삭제). 사용자가 버튼을 눌러야 실행된다.
function DraftCard({
  draft,
  lang,
  labels,
  onConfirm,
  onCancel,
}: {
  draft: Draft;
  lang: Locale;
  labels: Labels;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { draft: change, status } = draft;
  const t = labels.draft;
  const busy = status === "saving";
  const open = status === "pending" || status === "failed" || busy;
  const kind = change.kind;
  const title = kind === "create" ? t.title : kind === "update" ? t.updateTitle : t.deleteTitle;
  const action = kind === "create" ? t.add : kind === "update" ? t.update : t.delete;
  const done = kind === "create" ? t.saved : kind === "update" ? t.updated : t.deleted;
  const cancelled = kind === "create" ? t.cancelled : kind === "update" ? t.cancelledUpdate : t.cancelledDelete;
  const viewDate = change.kind === "create" || change.kind === "update" ? change.input.startDate : null;

  return (
    <div className="flex w-[88%] flex-col gap-2 rounded-2xl border bg-background p-3 text-sm shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {change.kind === "create" && <EventSummary input={change.input} labels={labels} />}
      {change.kind === "update" && (
        <>
          <p className="text-[11px] text-muted-foreground">{t.before}</p>
          <EventSummary input={change.before} labels={labels} muted />
          <p className="text-[11px] text-muted-foreground">{t.after}</p>
          <EventSummary input={change.input} labels={labels} />
        </>
      )}
      {change.kind === "delete" && <EventSummary input={change.event} labels={labels} />}
      {status === "failed" && (
        <p role="alert" className="text-xs text-destructive">
          {t.failed}
        </p>
      )}
      {open ? (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
            {t.discard}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "delete" ? "destructive" : "default"}
            disabled={busy}
            onClick={onConfirm}
          >
            {kind === "create" && <Plus aria-hidden="true" />}
            {busy ? t.saving : status === "failed" ? t.retry : action}
          </Button>
        </div>
      ) : status === "saved" ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Check className="size-3.5" aria-hidden="true" />
            {done}
          </span>
          {viewDate && (
            <Link
              href={`/${lang}/day/${viewDate}`}
              className="rounded text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t.view}
            </Link>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{cancelled}</p>
      )}
    </div>
  );
}
