import { X } from "lucide-react";

// 저장 실패 등을 알리는 화면 아래 알림. 호출하는 쪽이 일정 시간 뒤 닫는다.
export function EditorToast({
  message,
  dismissLabel,
  onDismiss,
}: {
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-destructive/40 bg-popover px-4 py-3 text-sm text-destructive shadow-lg"
    >
      <span>{message}</span>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={onDismiss}
        className="rounded p-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
