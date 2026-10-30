"use client";

import { useState, useTransition } from "react";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fillTemplate, formatFullDate, type CalendarDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { saveDayNote } from "@/lib/notes/actions";
import { NOTE_MAX } from "@/lib/notes/input";

export type DayNoteLabels = Dictionary["dayNote"];

// 날짜별 메모 팝업. 저장하면 서버가 화면을 다시 그린다(저장 성공 시 닫는다). 내용을 비우고 저장하면 메모가 지워진다.
// 열릴 때마다 새로 마운트돼 입력칸이 저장된 값으로 시작한다.
export function DayNoteDialog({
  open,
  onOpenChange,
  date,
  note,
  lang,
  labels,
  unavailable = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: CalendarDate;
  note: string | undefined;
  lang: Locale;
  labels: DayNoteLabels;
  unavailable?: boolean; // 메모를 못 읽은 상태: 있던 메모를 덮어쓰지 않도록 수정을 막는다
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // 팝업 안의 입력이 뒤쪽 그리드의 끌기·단축키 처리로 번지지 않게 한다(React 트리로는 그리드 안에 있다).
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <NoteForm
          date={date}
          note={note}
          lang={lang}
          labels={labels}
          unavailable={unavailable}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({
  date,
  note,
  lang,
  labels,
  unavailable,
  onDone,
}: {
  date: CalendarDate;
  note: string | undefined;
  lang: Locale;
  labels: DayNoteLabels;
  unavailable: boolean;
  onDone: () => void;
}) {
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const title = fillTemplate(labels.title, { date: formatFullDate(date, lang) });
  const shownError = unavailable ? labels.errors.loadFailed : error;
  const locked = pending || unavailable;

  function save(content: string) {
    if (unavailable) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveDayNote(date, content);
        if (result.ok) onDone();
        else setError(labels.errors[result.code]);
      } catch {
        // 네트워크 단절·서버 오류로 Action 자체가 실패한 경우
        setError(labels.errors.failed);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(text);
      }}
      className="grid gap-3"
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Textarea
        autoFocus
        value={text}
        maxLength={NOTE_MAX}
        rows={6}
        placeholder={labels.placeholder}
        aria-label={title}
        aria-invalid={!!shownError}
        disabled={unavailable}
        onChange={(e) => setText(e.target.value)}
        className="max-h-[50dvh] min-h-32 resize-none"
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span role={shownError ? "alert" : undefined} className={shownError ? "text-destructive" : undefined}>
          {shownError}
        </span>
        <span>{fillTemplate(labels.count, { count: text.length, max: NOTE_MAX })}</span>
      </div>
      <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
        {note ? (
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() => save("")}
            className="text-destructive"
          >
            {labels.delete}
          </Button>
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onDone}>
            {labels.cancel}
          </Button>
          <Button type="submit" disabled={locked}>
            {pending ? labels.saving : labels.save}
          </Button>
        </span>
      </DialogFooter>
    </form>
  );
}

// 메모가 있다는 작은 아이콘. 누르면 같은 팝업이 열린다(월간 날짜 칸용).
export function DayNoteIcon({
  date,
  note,
  lang,
  labels,
}: {
  date: CalendarDate;
  note: string;
  lang: Locale;
  labels: DayNoteLabels;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-slot="day-note-button"
        aria-label={`${labels.open}: ${note.slice(0, 40)}`}
        title={note.slice(0, 80)}
        onClick={() => setOpen(true)}
        className="relative z-10 inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <StickyNote aria-hidden="true" className="size-3.5" />
      </button>
      <DayNoteDialog
        open={open}
        onOpenChange={setOpen}
        date={date}
        note={note}
        lang={lang}
        labels={labels}
      />
    </>
  );
}
