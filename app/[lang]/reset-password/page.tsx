import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUser } from "@/lib/supabase/require-user";

export default function ResetPasswordPage(props: PageProps<"/[lang]/reset-password">) {
  // params와 로그인 사용자는 요청 시점 데이터이므로 Suspense 안에서 읽는다.
  return (
    <Suspense>
      <ResetPasswordContent {...props} />
    </Suspense>
  );
}

async function ResetPasswordContent({ params }: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  // 재설정 메일의 링크(/auth/callback?recovery=1)가 만든 로그인 상태에서만 쓴다. 로그인 확인이 현재 시각을 쓰므로 요청 시점으로 미룬다.
  await connection();
  const session = await requireUser();
  if (!session) redirect(`/${lang}/forgot-password?error=expired`);
  // 이메일이 없는 게스트 계정은 비밀번호를 정할 수 없다.
  if (session.user.is_anonymous === true) redirect(`/${lang}`);

  return (
    <AuthShell lang={lang}>
      <ResetPasswordForm lang={lang} dict={dict.resetPassword} login={dict.login} />
    </AuthShell>
  );
}
