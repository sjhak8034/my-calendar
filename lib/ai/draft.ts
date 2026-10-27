import type { EventInput } from "@/lib/events/input";

// AI가 만든 변경안. 모델은 저장하지 못하고, 화면의 카드에서 사용자가 버튼을 눌러야 실행된다.
export type AiDraft =
  | { kind: "create"; input: EventInput }
  | { kind: "update"; id: string; before: EventInput; input: EventInput }
  | { kind: "delete"; id: string; event: EventInput };
