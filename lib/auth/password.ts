// 비밀번호 규칙. 가입·게스트 계정 전환·비밀번호 재설정이 함께 쓴다.
// Supabase 대시보드(Authentication > Sign In / Providers > Email > Password requirements)의 정책도 같은 값으로 맞춘다.
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordIssue = "tooShort" | "needsLetterAndNumber";

// 규칙을 지키면 null, 아니면 어떤 규칙을 어겼는지 돌려준다.
export function checkPassword(password: string): PasswordIssue | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "needsLetterAndNumber";
  return null;
}
