"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { useDayWeather, useWeatherCredit } from "@/components/weather/weather-provider";
import type { CalendarDate } from "@/lib/calendar";
import type { WeatherKind } from "@/lib/weather/codes";
import { cn } from "@/lib/utils";

const ICONS: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
};

// 날씨 종류별 색(맑음은 따뜻하게, 비·눈은 차갑게). 일정 색과 겹치지 않게 옅게 쓴다.
const TONES: Record<WeatherKind, string> = {
  clear: "text-amber-500",
  partly: "text-amber-500",
  cloudy: "text-muted-foreground",
  fog: "text-muted-foreground",
  drizzle: "text-sky-500",
  rain: "text-sky-600 dark:text-sky-400",
  snow: "text-sky-400",
  thunder: "text-violet-500",
};

// 그 날짜의 날씨 아이콘. 날씨가 없으면(예보 밖 날짜, 아직 받는 중, 받지 못함) 아무것도 그리지 않아 자리를 차지하지 않는다.
// 장식이라 스크린 리더에는 숨기고(날짜 링크의 이름에 날씨를 넣는 쪽이 읽기 편하다), 마우스를 올리면 기온을 보여 준다(showTitle).
export function WeatherIcon({
  date,
  showTitle = false,
  className,
}: {
  date: CalendarDate;
  showTitle?: boolean;
  className?: string;
}) {
  const weather = useDayWeather(date);
  if (!weather) return null;
  const Icon = ICONS[weather.kind];
  return (
    <span data-slot="weather-icon" data-kind={weather.kind} title={showTitle ? weather.description : undefined} className="inline-flex">
      <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", TONES[weather.kind], className)} />
    </span>
  );
}

// 그리드 아래의 출처 표기(날씨 서비스 이용 조건). 날씨를 받았을 때만 보인다.
export function WeatherCredit({ className }: { className?: string }) {
  const credit = useWeatherCredit();
  if (!credit) return null;
  return (
    <p data-slot="weather-credit" className={cn("text-xs text-muted-foreground", className)}>
      {credit.text}{" "}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground">
        Open-Meteo
      </a>
    </p>
  );
}
