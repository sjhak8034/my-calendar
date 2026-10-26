import { Suspense } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { NavMenu } from "./nav-menu";
import { UserCard } from "./user-card";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

// lg 이상에서 보이는 왼쪽 고정 사이드바
export function Sidebar({ lang, nav }: { lang: string; nav: Dictionary["nav"] }) {
  return (
    <aside
      data-slot="sidebar"
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex"
    >
      <Link
        href={`/${lang}`}
        className="rounded-md px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BrandLogo textClassName="text-xl leading-none" iconClassName="size-8" />
      </Link>
      <div className="flex-1">
        {/* usePathname은 동적 경로([date])에서 런타임 데이터라 Suspense가 필요하다 */}
        <Suspense fallback={null}>
          <NavMenu lang={lang} labels={nav} />
        </Suspense>
      </div>
      <UserCard lang={lang} nav={nav} />
    </aside>
  );
}
