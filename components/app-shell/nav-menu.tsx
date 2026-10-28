"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  lang: string;
  labels: {
    calendar: string;
    settings: string;
    mainMenu: string;
  };
  // 모바일 시트에서 링크 이동 시 시트를 닫기 위한 콜백
  onNavigate?: () => void;
};

const itemClass =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium";
const linkClass =
  "text-muted-foreground outline-none transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[active=true]:bg-muted data-[active=true]:text-foreground";

// 활성 표시에 usePathname이 필요해 이 부분만 클라이언트 컴포넌트로 둔다.
export function NavMenu({ lang, labels, onNavigate }: Props) {
  const pathname = usePathname();
  const home = `/${lang}`;
  // 캘린더 화면: 홈과 날짜 상세
  const calendarActive = pathname === home || pathname.startsWith(`${home}/day`);
  const settingsHref = `${home}/settings`;
  const settingsActive = pathname === settingsHref || pathname.startsWith(`${settingsHref}/`);

  return (
    <nav aria-label={labels.mainMenu}>
      <ul className="flex flex-col gap-1">
        <li>
          <Link
            href={home}
            onClick={onNavigate}
            aria-current={calendarActive ? "page" : undefined}
            data-active={calendarActive}
            className={cn(itemClass, linkClass)}
          >
            <CalendarDays className="size-[1.125rem]" aria-hidden="true" />
            {labels.calendar}
          </Link>
        </li>
        <li>
          <Link
            href={settingsHref}
            onClick={onNavigate}
            aria-current={settingsActive ? "page" : undefined}
            data-active={settingsActive}
            className={cn(itemClass, linkClass)}
          >
            <Settings className="size-[1.125rem]" aria-hidden="true" />
            {labels.settings}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
