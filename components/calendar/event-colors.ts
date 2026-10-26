import type { EventColor } from "@/lib/calendar";

// 팔레트 키 → 클래스. Tailwind가 정적으로 찾을 수 있게 전체 클래스를 그대로 적는다.
export const COLOR_CLASS: Record<EventColor, string> = {
  gray: "border-event-gray-border bg-event-gray-bg text-event-gray-fg",
  blue: "border-event-blue-border bg-event-blue-bg text-event-blue-fg",
  indigo: "border-event-indigo-border bg-event-indigo-bg text-event-indigo-fg",
  purple: "border-event-purple-border bg-event-purple-bg text-event-purple-fg",
  pink: "border-event-pink-border bg-event-pink-bg text-event-pink-fg",
  orange: "border-event-orange-border bg-event-orange-bg text-event-orange-fg",
  yellow: "border-event-yellow-border bg-event-yellow-bg text-event-yellow-fg",
  green: "border-event-green-border bg-event-green-bg text-event-green-fg",
};

// 대화상자의 색 표시 점
export const DOT_CLASS: Record<EventColor, string> = {
  gray: "bg-event-gray-fg",
  blue: "bg-event-blue-fg",
  indigo: "bg-event-indigo-fg",
  purple: "bg-event-purple-fg",
  pink: "bg-event-pink-fg",
  orange: "bg-event-orange-fg",
  yellow: "bg-event-yellow-fg",
  green: "bg-event-green-fg",
};
