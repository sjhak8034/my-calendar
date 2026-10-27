"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { NavMenu } from "./nav-menu";

type Props = {
  lang: string;
  labels: {
    calendar: string;
    settings: string;
    comingSoon: string;
    mainMenu: string;
    menuTitle: string;
    openMenu: string;
    closeMenu: string;
  };
  // 서버에서 렌더한 사용자 카드
  footer: ReactNode;
};

// lg 미만: 상단 바 + 왼쪽 시트
export function MobileNav({ lang, labels, footer }: Props) {
  const [open, setOpen] = useState(false);

  // 시트가 열린 채 lg 이상(사이드바 표시)으로 넓어지면 오버레이가 남지 않게 닫는다.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <header
      data-slot="mobile-header"
      className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-2 lg:hidden"
    >
      <Link
        href={`/${lang}`}
        className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BrandLogo textClassName="text-lg leading-none" iconClassName="size-8" />
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={labels.openMenu}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="p-4 lg:hidden">
          <div className="flex items-center justify-between">
            <SheetTitle className="sr-only">{labels.menuTitle}</SheetTitle>
            <BrandLogo textClassName="text-lg leading-none" iconClassName="size-8" />
            <SheetClose
              render={
                <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.closeMenu} />
              }
            >
              <X aria-hidden="true" />
            </SheetClose>
          </div>
          <div className="flex-1">
            <Suspense fallback={null}>
              <NavMenu lang={lang} labels={labels} onNavigate={() => setOpen(false)} />
            </Suspense>
          </div>
          {footer}
        </SheetContent>
      </Sheet>
    </header>
  );
}
