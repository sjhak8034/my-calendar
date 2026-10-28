// 로그인·비밀번호 찾기·재설정 화면이 함께 쓰는 카드와 입력창 모양(시안의 둥근 카드).
// cn이 충돌 클래스를 병합하지 않으므로 입력창은 ! 로 기본값을 덮어쓴다.
export const AUTH_CARD_CLASS =
  "flex w-full max-w-[38rem] flex-col gap-6 rounded-[2rem] bg-card p-6 text-card-foreground shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--foreground)_18%,transparent)] dark:shadow-[0_24px_60px_-20px_color-mix(in_oklab,black_50%,transparent)] sm:p-12";
export const AUTH_INPUT_CLASS = "h-12! rounded-xl! bg-card! px-4! text-sm!";
