import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// 일정을 끌 때 화면 아래에 나타나는 삭제 영역. 여기에 놓으면 일정이 삭제된다.
// 위치 판정은 drag-session이 이 요소의 rect(data-slot="delete-zone")로 하므로 포인터 이벤트는 받지 않는다.
// 마우스 드래그 보조 수단이라 보조기기에는 숨기고, 삭제의 대안은 사이드바의 삭제 버튼이다.
export function DeleteDropZone({
  visible,
  active,
  panelOpen,
}: {
  visible: boolean;
  active: boolean; // 끄는 블록이 영역 위에 있음
  panelOpen: boolean; // 사이드바(큰 화면은 오른쪽, 작은 화면은 아래 시트)가 열려 있음
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center",
        // 사이드바가 열리고 닫힐 때 위치도 부드럽게 따라 움직인다.
        "transition-[bottom,right] duration-300 ease-out motion-reduce:transition-none",
        panelOpen && "max-lg:bottom-[calc(50dvh+1rem)] lg:right-[22rem] lg:left-0",
      )}
    >
      <div
        data-slot="delete-zone"
        className={cn(
          "flex size-14 items-center justify-center rounded-full border shadow-lg motion-reduce:transition-none",
          // 나타날 때는 아래에서 천천히 감속하며 올라오고, 숨을 때는 조금 더 빠르게 내려간다.
          // 블록이 올라오면 살짝 튕기듯 커져(overshoot) 반응이 눈에 띄게 한다.
          "transition-[transform,opacity,background-color,color,box-shadow,border-color]",
          visible
            ? active
              ? "duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              : "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            : "duration-200 ease-in",
          visible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0",
          visible && !active && "scale-100",
          !visible && "scale-75",
          active
            ? "scale-125 border-destructive bg-destructive text-white shadow-xl shadow-destructive/30"
            : "bg-popover text-muted-foreground",
        )}
      >
        <X
          className={cn(
            "size-6 transition-transform duration-200 ease-out motion-reduce:transition-none",
            active && "rotate-90",
          )}
        />
      </div>
    </div>
  );
}
