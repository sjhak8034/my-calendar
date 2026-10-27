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
    comingSoon: string;
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
        {/* 페이지가 생기기 전까지는 링크가 아닌 비활성 항목 */}
        <li>
          <span
            aria-disabled="true"
            className={cn(itemClass, "cursor-not-allowed text-muted-foreground/70")}
          >
            <Settings className="size-[1.125rem]" aria-hidden="true" />
            {labels.settings}
            <span className="ml-auto rounded-md border px-1.5 py-0.5 text-[10px] font-normal leading-none">{labels.comingSoon}</span>
          </span>
        </li>
      </ul>
    </nav>
  );
}
