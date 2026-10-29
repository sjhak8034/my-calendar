import { notFound } from "next/navigation";
import { AiWidget } from "@/components/ai/ai-widget";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { PushAutoSubscribe } from "@/components/app-shell/push-auto-subscribe";
import { Sidebar } from "@/components/app-shell/sidebar";
import { UserCard } from "@/components/app-shell/user-card";
import { WeatherProvider } from "@/components/weather/weather-provider";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

// lg 이상: 왼쪽 사이드바 + 본문. lg 미만: 상단 바 + 시트 메뉴.
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { nav, ai, weather } = await getDictionary(lang);

  return (
    // 날씨는 여기서 한 번만 받아 월간·주간에 나눠 준다(달·주를 옮겨도 다시 받지 않는다).
    <WeatherProvider labels={weather}>
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <Sidebar lang={lang} nav={nav} />
      <MobileNav
        lang={lang}
        labels={{
          calendar: nav.calendar,
          settings: nav.settings,
          mainMenu: nav.mainMenu,
          menuTitle: nav.menuTitle,
          openMenu: nav.openMenu,
          closeMenu: nav.closeMenu,
        }}
        footer={<UserCard lang={lang} nav={nav} />}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <AiWidget lang={lang} labels={ai} />
      <PushAutoSubscribe lang={lang} />
    </div>
    </WeatherProvider>
  );
}
