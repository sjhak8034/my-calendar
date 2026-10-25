import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-background p-8 text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">my-calendar</h1>
      <p className="text-muted-foreground">{dict.home.calendarPlaceholder}</p>
    </main>
  );
}
