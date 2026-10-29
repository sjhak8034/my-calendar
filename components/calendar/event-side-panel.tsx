"use client";

import { X } from "lucide-react";
import { EventForm } from "@/components/calendar/event-form";
import { useWeekEditor } from "@/components/calendar/week-editor";

// 오른쪽 사이드바(작은 화면은 아래 시트). 모달이 아니라서 열려 있는 동안에도 그리드를 끌 수 있다.
export function EventSidePanel() {
  const { panel, labels, hint, close, closeSession, updateValues } = useWeekEditor();
  if (!panel) return null;
  const title = panel.mode === "edit" ? labels.editEvent : labels.newEvent;
  return (
    <aside
      data-slot="event-side-panel"
      aria-label={labels.panelLabel}
      className="animate-in fade-in-0 slide-in-from-bottom-6 duration-200 ease-out motion-reduce:animate-none lg:slide-in-from-right-8 lg:slide-in-from-bottom-0 fixed inset-x-0 bottom-0 z-40 flex max-h-[50dvh] flex-col border-t bg-popover text-popover-foreground shadow-2xl lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:max-h-none lg:w-[22rem] lg:border-t-0 lg:border-l"
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <button
          type="button"
          aria-label={labels.closePanel}
          onClick={close}
          className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {hint && <p className="px-5 pb-2 text-xs text-muted-foreground">{hint}</p>}
      <EventForm
        key={panel.session}
        mode={panel.mode}
        eventId={panel.eventId ?? undefined}
        values={panel.values}
        onChange={updateValues}
        labels={labels}
        onDone={() => closeSession(panel.session)}
        onCancel={close}
      />
    </aside>
  );
}
