import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { IntroOverlay } from "@/components/welcome/intro-overlay";
import { hasLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang: value } = await params;
  if (!hasLocale(value)) return {};
  const dict = await getDictionary(value);
  return { title: dict.meta.title, description: dict.meta.description };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }));
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  const { welcome } = await getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div data-slot="page-root" className="flex flex-1 flex-col">
          {children}
        </div>
        {/* 로그인 직후 인트로. 환영 페이지에서 캘린더로 옮겨 가는 동안 계속 덮도록 페이지가 바뀌어도 유지되는 이 레이아웃에 둔다. */}
        <Suspense>
          <IntroOverlay lang={locale} title={welcome.title} skipLabel={welcome.skip} />
        </Suspense>
      </body>
    </html>
  );
}
