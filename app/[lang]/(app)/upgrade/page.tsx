import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { UpgradeForm } from "@/components/auth/upgrade-form";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUser } from "@/lib/supabase/require-user";

export default function UpgradePage(props: PageProps<"/[lang]/upgrade">) {
  // params/searchParams와 로그인 사용자는 요청 시점 데이터이므로 Suspense 안에서 읽는다.
  return (
    <Suspense fallback={<UpgradeSkeleton />}>
      <UpgradeContent {...props} />
    </Suspense>
  );
}

const PAGE_CLASS = "mx-auto flex w-full max-w-xl flex-col gap-5 p-4 pb-10 sm:p-6 sm:pb-12 lg:p-8 lg:pb-12";

async function UpgradeContent({ params, searchParams }: PageProps<"/[lang]/upgrade">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { error } = await searchParams;
  const dict = await getDictionary(lang);

  // 게스트만 쓰는 화면이다. 정식 계정이거나 로그인 정보가 없으면 홈으로 보낸다.
  await connection();
  const session = await requireUser();
  if (!session || session.user.is_anonymous !== true) redirect(`/${lang}`);

  const initialError =
    error === "identity" || error === "google" ? dict.upgrade.errors[error] : undefined;

  return (
    <main className={PAGE_CLASS}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.upgrade.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.upgrade.description}</p>
      </div>
      <UpgradeForm lang={lang} dict={dict.upgrade} login={dict.login} initialError={initialError} />
    </main>
  );
}

function UpgradeSkeleton() {
  return (
    <main aria-busy="true" className={PAGE_CLASS}>
      <div aria-hidden="true" className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div aria-hidden="true" className="h-64 animate-pulse rounded-xl border bg-card" />
    </main>
  );
}
