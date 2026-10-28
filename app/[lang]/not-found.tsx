import Link from "next/link";
import { lang } from "next/root-params";
import { CalendarX2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { defaultLocale, hasLocale } from "@/lib/i18n/config";
import { errorMessages } from "@/lib/i18n/error-messages";

// notFound()가 불린 곳과 어디에도 맞지 않는 주소(app/[lang]/[...rest])의 404 화면.
export default async function NotFound() {
  const value = await lang();
  const locale = hasLocale(value) ? value : defaultLocale;
  const t = errorMessages[locale];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <CalendarX2 className="size-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">{t.notFoundTitle}</h1>
      <p className="text-sm text-muted-foreground">{t.notFoundDescription}</p>
      <Link href={`/${locale}`} className={buttonVariants({ size: "lg" })}>
        {t.backToCalendar}
      </Link>
    </main>
  );
}
