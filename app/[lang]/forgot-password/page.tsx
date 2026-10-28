import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default function ForgotPasswordPage(props: PageProps<"/[lang]/forgot-password">) {
  // params·searchParams는 요청 시점 데이터이므로 Suspense 안에서 읽는다.
  return (
    <Suspense>
      <ForgotPasswordContent {...props} />
    </Suspense>
  );
}

async function ForgotPasswordContent({ params, searchParams }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { error } = await searchParams;
  const dict = await getDictionary(lang);

  return (
    <AuthShell lang={lang}>
      <ForgotPasswordForm
        lang={lang}
        dict={dict.forgotPassword}
        login={dict.login}
        // 만료된 재설정 링크로 돌아온 경우(/auth/callback이 보냄)
        initialError={error === "expired" ? dict.forgotPassword.expired : undefined}
      />
    </AuthShell>
  );
}
