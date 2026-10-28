import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site";

// 로그인 없이 볼 수 있는 화면만 담는다. 현재 시각(lastModified)은 prerender를 막으므로 넣지 않는다.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return locales.flatMap((locale) => [{ url: `${base}/${locale}/login` }, { url: `${base}/${locale}/privacy` }]);
}
