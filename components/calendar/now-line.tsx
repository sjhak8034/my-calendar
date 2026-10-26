"use client";

import { useEffect, useState } from "react";
import { formatTime, toSeoulDateTime, type CalendarDate } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";

type Props = {
  nowIso: string; // 서버가 요청 시점에 계산한 초기값(hydration 일치용)
  weekDates: readonly CalendarDate[];
  startHour: number;
  endHour: number;
  locale: Locale;
};

// 이번 주를 볼 때만 보이는 현재 시각 점선. 위치는 날짜 열 본문(relative) 높이 기준 %.
// 컨테이너는 본문 전체 너비이고, 시각 라벨은 가로 스크롤해도 눈금 열 위치에 고정(sticky)된다.
export function NowLine({ nowIso, weekDates, startHour, endHour, locale }: Props) {
  const [iso, setIso] = useState(nowIso);

  // 첫 렌더는 서버 값(hydration 일치). 마운트 직후 한 번, 이후 1분마다와 탭이 다시 보일 때 현재 시각으로 맞춘다.
  useEffect(() => {
    const sync = () => setIso(new Date().toISOString());
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    sync();
    const id = setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const { date, minutes } = toSeoulDateTime(iso);
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;
  if (!weekDates.includes(date) || minutes < rangeStart || minutes >= rangeEnd) {
    return null;
  }
  const top = ((minutes - rangeStart) / (rangeEnd - rangeStart)) * 100;

  return (
    <div
      aria-hidden="true"
      data-slot="now-line"
      className="pointer-events-none absolute inset-x-0 z-[35] h-0"
      style={{ top: `${top}%` }}
    >
      <span
        data-slot="now-line-label"
        suppressHydrationWarning
        className="sticky left-0 flex w-[var(--time-col)] -translate-y-1/2 items-center justify-end gap-1 bg-card py-0.5 text-[11px] leading-none font-medium whitespace-nowrap text-destructive"
      >
        {formatTime(iso, locale)}
        <span data-slot="now-line-dot" className="-mr-[3px] size-1.5 shrink-0 rounded-full bg-destructive" />
      </span>
      <div
        data-slot="now-line-rule"
        className="absolute top-0 right-0 left-[var(--time-col)] border-t-2 border-dotted border-destructive"
      />
    </div>
  );
}
