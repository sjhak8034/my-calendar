import "server-only";
import type { Locale } from "./config";
import type ko from "./dictionaries/ko.json";

export type Dictionary = typeof ko;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ko: () => import("./dictionaries/ko.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

// Server Action에서는 next/root-params를 쓸 수 없으므로 locale을 인자로 받는다.
export const getDictionary = (locale: Locale) => dictionaries[locale]();
