export const EVENT_COLORS = [
  "gray",
  "blue",
  "indigo",
  "purple",
  "pink",
  "orange",
  "yellow",
  "green",
] as const;

export type EventColor = (typeof EVENT_COLORS)[number];

export const DEFAULT_EVENT_COLOR: EventColor = "gray";

// 팔레트에 없거나 비어 있으면 gray
export function normalizeEventColor(
  value: string | null | undefined,
): EventColor {
  const key = value?.trim().toLowerCase();
  return (EVENT_COLORS as readonly string[]).includes(key ?? "")
    ? (key as EventColor)
    : DEFAULT_EVENT_COLOR;
}
