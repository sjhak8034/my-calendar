import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/site";

// 개인정보처리방침. 본문은 사전(privacy.sections)에 두고 ko/en이 같은 구조를 가진다.
export default async function PrivacyPage({
  params,
}: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { privacy } = await getDictionary(lang);

  return (
    <main className="flex flex-1 justify-center bg-background p-4 text-foreground sm:p-8">
      <article className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{privacy.title}</h1>
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">{privacy.draftNotice}</p>
          <p className="text-sm text-muted-foreground">{privacy.effective}</p>
          <p className="text-sm leading-relaxed">{privacy.intro}</p>
        </header>
        {privacy.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            {"body" in section &&
              section.body?.map((text) => (
                <p key={text} className="text-sm leading-relaxed">
                  {text}
                </p>
              ))}
            {"items" in section && section.items && (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{privacy.contactLabel}</h2>
          <a
            href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
            className="w-fit rounded-sm text-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PRIVACY_CONTACT_EMAIL}
          </a>
        </section>
        <Link
          href={`/${lang}/login`}
          className="w-fit rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {privacy.backToLogin}
        </Link>
      </article>
    </main>
  );
}
