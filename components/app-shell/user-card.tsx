import { Suspense, cache } from "react";
import { connection } from "next/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/[lang]/login/actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";

// 사이드바와 모바일 시트가 같은 요청에서 두 번 렌더하므로 요청당 한 번만 조회한다.
const getUserEmail = cache(async () => {
  // Supabase 세션 확인이 Date.now()를 쓰므로 요청 시점으로 미룬다(cacheComponents).
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "";
});

async function UserEmail() {
  return (
    <span className="min-w-0 flex-1 truncate text-sm">{await getUserEmail()}</span>
  );
}

// 이메일, 언어 선택, 로그아웃. 쿠키를 읽는 이메일은 Suspense 안에 둔다.
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
          <UserEmail />
        </Suspense>
        <LanguageSwitcher
          lang={lang}
          label={nav.languageMenuLabel}
          languages={nav.languages}
        />
      </div>
      <form action={signOut}>
        <input type="hidden" name="lang" value={lang} />
        <Button type="submit" variant="secondary" size="sm" className="w-full text-muted-foreground">
          {nav.signOut}
        </Button>
      </form>
    </div>
  );
}
