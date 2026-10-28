import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// 로그인해야 쓰는 앱이라 검색 엔진에는 공개 화면(로그인·개인정보처리방침)만 알린다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
