import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

// 비밀번호 찾기·재설정처럼 로그인 화면보다 단순한 인증 화면의 바깥 틀(로고 + 가운데 카드).
export function AuthShell({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col items-center gap-8 bg-background px-4 py-10 text-foreground sm:px-6">
      <Link
        href={`/${lang}/login`}
        className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BrandLogo textClassName="text-2xl leading-none" iconClassName="size-10" />
      </Link>
      <main className="flex w-full flex-1 items-start justify-center sm:items-center">{children}</main>
    </div>
  );
}
