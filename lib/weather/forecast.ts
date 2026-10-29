import { isValidDate, type CalendarDate } from "@/lib/calendar";
import { WEATHER_KINDS, weatherKind, type WeatherKind } from "./codes";

// 하루의 날씨. 기온은 반올림한 정수(°C).
export type DayWeather = { kind: WeatherKind; tempMax: number; tempMin: number };
export type Forecast = Record<CalendarDate, DayWeather>;

// 위치를 못 받을 때 쓰는 기본 위치(서울).
export const SEOUL = { lat: 37.57, lon: 126.98 } as const;

// 날씨 서비스(Open-Meteo)에 보내는 좌표는 소수 둘째 자리(약 1km)까지만 쓴다. 정확한 위치를 바깥에 보내지 않으려는 것이다.
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

// 앱의 날짜가 서울 기준이라 날짜 키가 어긋나지 않게 시간대를 서울로 고정해 받는다. 예보는 오늘부터 최대 16일.
export function forecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "Asia/Seoul",
    forecast_days: "16",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

// 브라우저에 저장해 둔 예보를 다시 읽을 때의 검증(예전 형식이거나 손으로 고친 값이면 버리고 새로 받는다).
export function isForecast(value: unknown): value is Forecast {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(([date, day]) => {
      if (!isValidDate(date) || typeof day !== "object" || day === null) return false;
      const { kind, tempMax, tempMin } = day as Record<string, unknown>;
      return (
        typeof kind === "string" &&
        (WEATHER_KINDS as readonly string[]).includes(kind) &&
        typeof tempMax === "number" &&
        Number.isFinite(tempMax) &&
        typeof tempMin === "number" &&
        Number.isFinite(tempMin)
      );
    })
  );
}

// -0.4 같은 값이 "-0°"로 보이지 않게 0으로 바로잡는다.
function toTemp(value: number): number {
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

// 날씨 서비스 응답 → 날짜별 날씨. 응답 모양이 다르면 null.
// 마지막 날처럼 값이 null인 날짜는 건너뛴다(그 칸은 아이콘 없이 비운다).
export function parseForecast(json: unknown): Forecast | null {
  if (typeof json !== "object" || json === null) return null;
  const daily = (json as { daily?: unknown }).daily;
  if (typeof daily !== "object" || daily === null) return null;
  const { time, weather_code, temperature_2m_max, temperature_2m_min } = daily as Record<string, unknown>;
  if (
    !Array.isArray(time) ||
    !Array.isArray(weather_code) ||
    !Array.isArray(temperature_2m_max) ||
    !Array.isArray(temperature_2m_min) ||
    weather_code.length !== time.length ||
    temperature_2m_max.length !== time.length ||
    temperature_2m_min.length !== time.length
  ) {
    return null;
  }

  const forecast: Forecast = {};
  time.forEach((date, i) => {
    const code = weather_code[i];
    const max = temperature_2m_max[i];
    const min = temperature_2m_min[i];
    if (typeof date !== "string" || !isValidDate(date)) return;
    if (typeof code !== "number" || typeof max !== "number" || typeof min !== "number") return;
    if (!Number.isFinite(code) || !Number.isFinite(max) || !Number.isFinite(min)) return;
    const kind = weatherKind(code);
    if (!kind) return;
    forecast[date] = { kind, tempMax: toTemp(max), tempMin: toTemp(min) };
  });
  return Object.keys(forecast).length > 0 ? forecast : null;
}
