// 계정 삭제 확인: 사용자가 입력한 이메일이 계정 이메일과 같은지(대소문자·앞뒤 공백은 무시).
// 화면(버튼 활성화)과 서버 액션이 같은 기준을 쓰도록 순수 함수로 둔다.
export function emailMatches(typed: unknown, accountEmail: string | null | undefined): boolean {
  if (typeof typed !== "string" || !accountEmail) return false;
  return typed.trim().toLowerCase() === accountEmail.trim().toLowerCase();
}

// 비밀번호로 로그인하는 계정인지(이메일 identity가 있는지). Google로만 가입한 계정은 비밀번호가 없어 이메일 입력으로 확인한다.
export function hasPasswordLogin(user: { identities?: { provider: string }[] | null }): boolean {
  return user.identities?.some((identity) => identity.provider === "email") === true;
}
