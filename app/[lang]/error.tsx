"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { defaultLocale, hasLocale } from "@/lib/i18n/config";
import { errorMessages } from "@/lib/i18n/error-messages";

// 화면을 그리다 예상하지 못한 오류가 나면 보여 주는 화면. digest는 서버 로그와 맞춰 볼 수 있는 값이라 민감한 정보가 아니다.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ lang?: string }>();
  const locale = hasLocale(params.lang) ? params.lang : defaultLocale;
  const t = errorMessages[locale];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert className="size-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">{t.errorTitle}</h1>
      <p className="text-sm text-muted-foreground">{t.errorDescription}</p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          {t.errorCode}: <code>{error.digest}</code>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="lg" onClick={reset}>
          <RotateCcw aria-hidden="true" />
          {t.retry}
        </Button>
        <Link href={`/${locale}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          {t.backToCalendar}
        </Link>
      </div>
    </main>
  );
}
