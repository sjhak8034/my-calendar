// 계정 삭제 확인: 사용자가 입력한 이메일이 계정 이메일과 같은지(대소문자·앞뒤 공백은 무시).
// 화면(버튼 활성화)과 서버 액션이 같은 기준을 쓰도록 순수 함수로 둔다.
export function emailMatches(typed: unknown, accountEmail: string | null | undefined): boolean {
  if (typeof typed !== "string" || !accountEmail) return false;
  return typed.trim().toLowerCase() === accountEmail.trim().toLowerCase();
}
