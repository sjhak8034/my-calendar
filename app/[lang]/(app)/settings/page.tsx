import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PushToggle } from "@/components/settings/push-toggle";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default function SettingsPage(props: PageProps<"/[lang]/settings">) {
  // params는 요청 시점 데이터이므로 Suspense 안에서 읽는다.
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent {...props} />
    </Suspense>
  );
}

const PAGE_CLASS = "mx-auto flex w-full max-w-xl flex-col gap-5 p-4 pb-10 sm:p-6 sm:pb-12 lg:p-8 lg:pb-12";

async function SettingsContent({ params }: PageProps<"/[lang]/settings">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { settings } = await getDictionary(lang);

  return (
    <main className={PAGE_CLASS}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{settings.title}</h1>
        <p className="text-sm text-muted-foreground">{settings.description}</p>
      </div>
      <PushToggle lang={lang} dict={settings.push} />
    </main>
  );
}

function SettingsSkeleton() {
  return (
    <main aria-busy="true" className={PAGE_CLASS}>
      <div aria-hidden="true" className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div aria-hidden="true" className="h-32 animate-pulse rounded-xl border bg-card" />
    </main>
  );
}
