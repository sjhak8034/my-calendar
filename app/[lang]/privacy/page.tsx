import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

// "준비 중" 자리표시자. 실제 정책 문구는 서비스 확장 전 별도로 작성한다.
export default async function PrivacyPage({
  params,
}: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background p-8 text-center text-foreground">
      <h1 className="text-3xl font-bold tracking-tight">{dict.privacy.title}</h1>
      <p className="text-muted-foreground">{dict.privacy.comingSoon}</p>
      <Link href={`/${lang}/login`} className="mt-2 rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
        {dict.privacy.backToLogin}
      </Link>
    </main>
  );
}
