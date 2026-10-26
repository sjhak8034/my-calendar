"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_COOKIE, hasLocale, locales } from "@/lib/i18n/config";

type Props = {
  // 현재 언어
  lang: string;
  // 버튼 aria-label (nav.languageMenuLabel)
  label: string;
  // 언어 코드별 표시 이름 (nav.languages)
  languages: Record<string, string>;
};

// 지구본 버튼 + 언어 드롭다운. 선택하면 같은 경로의 다른 언어 URL로 이동한다.
export function LanguageSwitcher({ lang, label, languages }: Props) {
  const router = useRouter();

  function handleChange(next: string) {
    if (!hasLocale(next) || next === lang) return;

    // 첫 세그먼트(언어)만 교체한다.
    // 경로도 클릭 시점에 window에서 읽는다(동적 경로에서 usePathname의 Suspense 요구를 피한다).
    const segments = window.location.pathname.split("/");
    segments[1] = next;
    // 쿼리는 클릭 시점에 window에서 읽는다(useSearchParams의 Suspense 요구를 피한다).
    const target = `${segments.join("/")}${window.location.search}`;

    // proxy도 방문 언어를 저장하지만, 이동 전에 바로 기억해 둔다.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.push(target);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <Globe aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup value={lang} onValueChange={handleChange}>
          {locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale}>
              {languages[locale] ?? locale}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
