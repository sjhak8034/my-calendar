import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { signOut } from "@/app/[lang]/login/actions";
import { createClient } from "@/lib/supabase/server";

// 최소한의 상단 바. 쿠키를 읽는 부분(getUser)은 Suspense 안에 둔다.
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2 sm:px-6">
        {/* 텍스트는 기존 text-lg(1.125rem)의 1.3배 */}
        <BrandLogo textClassName="text-[1.4625rem] leading-none" iconClassName="size-9" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Suspense
            fallback={
              <span
                aria-hidden="true"
                className="inline-block h-5 w-32 animate-pulse rounded bg-muted"
              />
            }
          >
            <UserEmail />
          </Suspense>
          <LanguageSwitcher
            lang={lang}
            label={dict.nav.languageMenuLabel}
            languages={dict.nav.languages}
          />
          <form action={signOut}>
            <input type="hidden" name="lang" value={lang} />
            <Button type="submit" variant="outline" size="sm">
              {dict.nav.signOut}
            </Button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}

async function UserEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <span className="text-sm text-muted-foreground">{user?.email}</span>;
}
