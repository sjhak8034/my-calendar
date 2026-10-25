import { notFound } from "next/navigation";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Sidebar } from "@/components/app-shell/sidebar";
import { UserCard } from "@/components/app-shell/user-card";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

// lg 이상: 왼쪽 사이드바 + 본문. lg 미만: 상단 바 + 시트 메뉴.
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { nav } = await getDictionary(lang);

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <Sidebar lang={lang} nav={nav} />
      <MobileNav
        lang={lang}
        labels={{
          calendar: nav.calendar,
          ai: nav.ai,
          settings: nav.settings,
          comingSoon: nav.comingSoon,
          mainMenu: nav.mainMenu,
          menuTitle: nav.menuTitle,
          openMenu: nav.openMenu,
          closeMenu: nav.closeMenu,
        }}
        footer={<UserCard lang={lang} nav={nav} />}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
