import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/auth/login-form";
import { LoginIllustrations } from "@/components/auth/login-illustrations";
import { LanguageSwitcher } from "@/components/language-switcher";
import { buttonVariants } from "@/components/ui/button";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/site";

// 언어와 무관한 문의 메일 주소
const CONTACT_EMAIL = PRIVACY_CONTACT_EMAIL;

export default function LoginPage(props: PageProps<"/[lang]/login">) {
  // searchParams는 요청 시점 데이터이므로 Suspense 안에서 읽는다.
  return (
    <Suspense>
      <LoginContent {...props} />
    </Suspense>
  );
}

async function LoginContent({
  params,
  searchParams,
}: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { error, mode } = await searchParams;
  const dict = await getDictionary(lang);

  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* 상단 바 */}
      <header className="mx-auto flex w-full max-w-[1600px] flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 pt-6 sm:px-8 lg:px-12 lg:pt-9">
        <div className="flex flex-col">
          <Link
            href={`/${lang}/login`}
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* 텍스트는 sm 이상에서 기존 text-2xl(1.5rem)의 1.3배, 모바일은 상단 바가 줄바꿈되지 않도록 기존 크기 */}
            <BrandLogo
              textClassName="text-2xl leading-none sm:text-[1.95rem]"
              iconClassName="size-10 sm:size-12"
            />
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            aria-label={`${dict.nav.sendEmail}: ${CONTACT_EMAIL}`}
            className="mt-3 inline-flex items-center justify-between gap-6 border-t border-foreground/20 pt-3 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {CONTACT_EMAIL}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher
            lang={lang}
            label={dict.nav.languageMenuLabel}
            languages={dict.nav.languages}
          />
          <Link
            href={`/${lang}/login?mode=signup`}
            className={`${buttonVariants({ variant: "default" })} h-11! rounded-xl! px-5! text-sm!`}
          >
            {dict.nav.signUp}
          </Link>
        </div>
      </header>

      <LoginIllustrations />

      {/* 카드 */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <LoginForm
          // 상단 바의 회원가입 링크로 모드가 바뀌면 폼 상태를 새로 시작한다.
          key={mode === "signup" ? "signUp" : "signIn"}
          lang={lang}
          dict={dict.login}
          initialMode={mode === "signup" ? "signUp" : "signIn"}
          initialError={error === "oauth" ? dict.errors.googleFailed : undefined}
        />
      </main>

      {/* 푸터 */}
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-8 text-sm">
        <span>{dict.footer.copyright}</span>
        <span aria-hidden="true" className="h-4 w-px bg-foreground/40" />
        <Link
          href={`/${lang}/privacy`}
          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {dict.footer.privacy}
        </Link>
      </footer>
    </div>
  );
}
