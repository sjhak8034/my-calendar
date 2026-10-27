import { Suspense, cache } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { GuestSignOut } from "@/components/app-shell/guest-sign-out";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/[lang]/login/actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";

// 사이드바와 모바일 시트가 같은 요청에서 두 번 렌더하므로 요청당 한 번만 조회한다.
const getUserInfo = cache(async () => {
  // Supabase 세션 확인이 Date.now()를 쓰므로 요청 시점으로 미룬다(cacheComponents).
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { email: user?.email ?? "", isGuest: user?.is_anonymous === true };
});

// 이메일. 게스트(익명 로그인)는 이메일이 없으므로 "게스트"로 표시한다.
async function UserEmail({ guestLabel }: { guestLabel: string }) {
  const { email, isGuest } = await getUserInfo();
  return (
    <span className="min-w-0 flex-1 truncate text-sm">{isGuest ? guestLabel : email}</span>
  );
}

// 로그아웃. 게스트는 데이터를 되찾을 수 없으니 확인 대화상자를 거친다.
async function SignOutControl({ lang, nav }: { lang: string; nav: Dictionary["nav"] }) {
  const { isGuest } = await getUserInfo();
  if (isGuest) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={`/${lang}/upgrade`}
          className="inline-flex h-7 w-full items-center justify-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {nav.upgrade}
        </Link>
        <GuestSignOut
          lang={lang}
          labels={{
            signOut: nav.signOut,
            title: nav.guestSignOutTitle,
            description: nav.guestSignOutDescription,
            cancel: nav.cancel,
          }}
        />
      </div>
    );
  }
  return (
    <form action={signOut}>
      <input type="hidden" name="lang" value={lang} />
      <Button type="submit" variant="secondary" size="sm" className="w-full text-muted-foreground">
        {nav.signOut}
      </Button>
    </form>
  );
}

// 이메일(게스트면 "게스트"), 언어 선택, 로그아웃. 쿠키를 읽는 이메일은 Suspense 안에 둔다.
export function UserCard({
  lang,
  nav,
}: {
  lang: string;
  nav: Dictionary["nav"];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-2.5 shadow-xs">
      <div className="flex items-center gap-2">
        <Suspense
          fallback={
            <span
              aria-hidden="true"
              className="inline-block h-5 flex-1 animate-pulse rounded bg-muted"
            />
          }
        >
          <UserEmail guestLabel={nav.guest} />
        </Suspense>
        <LanguageSwitcher
          lang={lang}
          label={nav.languageMenuLabel}
          languages={nav.languages}
        />
      </div>
      <Suspense
        fallback={
          <span
            aria-hidden="true"
            className="block h-7 w-full animate-pulse rounded-lg bg-muted"
          />
        }
      >
        <SignOutControl lang={lang} nav={nav} />
      </Suspense>
    </div>
  );
}
