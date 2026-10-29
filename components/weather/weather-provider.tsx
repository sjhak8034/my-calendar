"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CalendarDate } from "@/lib/calendar";
import type { WeatherKind } from "@/lib/weather/codes";
import { SEOUL, forecastUrl, isForecast, parseForecast, type DayWeather, type Forecast } from "@/lib/weather/forecast";

export type WeatherLabels = {
  kinds: Record<WeatherKind, string>;
  low: string;
  high: string;
  credit: string;
};

type WeatherContextValue = { forecast: Forecast | null; labels: WeatherLabels };

// 제공자 밖(예: 날씨를 쓰지 않는 화면)에서는 null이라 아이콘이 아무것도 그리지 않는다.
const WeatherContext = createContext<WeatherContextValue | null>(null);

const CACHE_KEY = "weather:forecast";
const DENIED_KEY = "weather:geo-denied";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 예보는 몇 시간 단위로 바뀌므로 3시간 동안 다시 받지 않는다
const DENIED_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 위치를 거부했으면 일주일은 다시 묻지 않는다
const FETCH_TIMEOUT_MS = 8000;
const GEO_TIMEOUT_MS = 5000;

// 저장소는 시크릿 창·차단 설정에서 막히거나 던질 수 있어 모든 접근을 감싼다. 못 써도 날씨는 매번 받아 보여 준다.
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장하지 못해도 화면은 그대로 동작한다.
  }
}

function readCachedForecast(): Forecast | null {
  const raw = readStorage(CACHE_KEY);
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as { at?: unknown; data?: unknown };
    if (typeof cached.at !== "number" || Date.now() - cached.at > CACHE_TTL_MS) return null;
    return isForecast(cached.data) ? cached.data : null;
  } catch {
    return null;
  }
}

type Place = { lat: number; lon: number };

// 기기 위치. 거부·오류·시간 초과·미지원이면 서울(거부는 일정 기간 다시 묻지 않도록 기록한다).
function getPlace(): Promise<Place> {
  const denied = Number(readStorage(DENIED_KEY));
  const recentlyDenied = Number.isFinite(denied) && denied > 0 && Date.now() - denied < DENIED_TTL_MS;
  if (recentlyDenied || typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(SEOUL);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) writeStorage(DENIED_KEY, String(Date.now()));
        resolve(SEOUL);
      },
      // 날씨는 도시 수준이면 충분해서 정확도를 낮추고(배터리·속도), 한 시간 안의 이전 위치를 재사용한다.
      { enableHighAccuracy: false, maximumAge: 60 * 60 * 1000, timeout: GEO_TIMEOUT_MS },
    );
  });
}

// 날씨를 한 번 받아 아래 화면 모두에 나눠 준다(레이아웃에 두어 달·주를 옮겨도 다시 받지 않는다).
// 위치는 브라우저 안에서만 쓰고 우리 서버로 보내지 않는다. 날씨 서비스에는 반올림한 좌표만 간다.
// 못 받으면(오프라인·차단·오류) 아이콘만 안 보이고 달력은 그대로 동작한다.
export function WeatherProvider({ labels, children }: { labels: WeatherLabels; children: ReactNode }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      const cached = readCachedForecast();
      if (cached) {
        if (!cancelled) setForecast(cached);
        return;
      }
      const place = await getPlace();
      if (cancelled) return;
      try {
        const response = await fetch(forecastUrl(place.lat, place.lon), {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
        });
        if (!response.ok) return;
        const parsed = parseForecast(await response.json());
        if (!parsed || cancelled) return;
        writeStorage(CACHE_KEY, JSON.stringify({ at: Date.now(), data: parsed }));
        setForecast(parsed);
      } catch {
        // 네트워크 오류·시간 초과·응답 형식 오류: 날씨 없이 둔다.
      }
    }
    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const value = useMemo(() => ({ forecast, labels }), [forecast, labels]);
  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export type DayWeatherView = DayWeather & {
  label: string; // "맑음"
  temps: string; // "12° / 21°"(최저 / 최고)
  description: string; // 낭독·툴팁용 "맑음, 최저 12°, 최고 21°"
};

// 그 날짜의 날씨(예보가 없거나 날씨를 못 받았으면 null).
export function useDayWeather(date: CalendarDate): DayWeatherView | null {
  const context = useContext(WeatherContext);
  const weather = context?.forecast?.[date];
  if (!context || !weather) return null;
  const label = context.labels.kinds[weather.kind];
  const { low, high } = context.labels;
  return {
    ...weather,
    label,
    temps: `${weather.tempMin}° / ${weather.tempMax}°`,
    description: `${label}, ${low} ${weather.tempMin}°, ${high} ${weather.tempMax}°`,
  };
}

// 날씨 데이터가 있을 때만 출처를 보여 준다(Open-Meteo 이용 조건: 출처 표기).
export function useWeatherCredit(): { text: string } | null {
  const context = useContext(WeatherContext);
  if (!context?.forecast) return null;
  return { text: context.labels.credit };
}
