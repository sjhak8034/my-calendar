// 화면에 보여 줄 날씨 종류. 날씨 서비스가 주는 WMO 코드(약 28가지)를 아이콘으로 구분되는 8가지로 묶는다.
export const WEATHER_KINDS = ["clear", "partly", "cloudy", "fog", "drizzle", "rain", "snow", "thunder"] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

// WMO 날씨 코드 → 종류. 모르는 코드는 null(아이콘을 그리지 않는다. 틀린 날씨를 보여 주는 것보다 낫다).
export function weatherKind(code: number): WeatherKind | null {
  if (code === 0 || code === 1) return "clear"; // 맑음, 대체로 맑음
  if (code === 2) return "partly"; // 구름 조금
  if (code === 3) return "cloudy"; // 흐림
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle"; // 이슬비(어는 이슬비 포함)
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain"; // 비, 소나기
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow"; // 눈, 눈 소나기
  if (code >= 95 && code <= 99) return "thunder";
  return null;
}
