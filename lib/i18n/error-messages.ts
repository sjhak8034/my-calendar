import type { Locale } from "./config";

// 오류·404 화면 문구. error.tsx·global-error.tsx는 클라이언트 컴포넌트라 서버 전용 사전(getDictionary)을 쓸 수 없고,
// 사전 JSON 전체를 클라이언트 번들에 넣기보다 이 작은 객체를 함께 쓴다.
export type ErrorMessages = {
  notFoundTitle: string;
  notFoundDescription: string;
  errorTitle: string;
  errorDescription: string;
  retry: string;
  backToCalendar: string;
  errorCode: string;
};

export const errorMessages: Record<Locale, ErrorMessages> = {
  ko: {
    notFoundTitle: "페이지를 찾을 수 없어요",
    notFoundDescription: "주소가 잘못됐거나 없어진 페이지예요.",
    errorTitle: "문제가 발생했어요",
    errorDescription: "잠시 후 다시 시도해 주세요. 계속되면 아래 오류 코드를 알려 주세요.",
    retry: "다시 시도",
    backToCalendar: "캘린더로 돌아가기",
    errorCode: "오류 코드",
  },
  en: {
    notFoundTitle: "Page not found",
    notFoundDescription: "The address is wrong or the page no longer exists.",
    errorTitle: "Something went wrong",
    errorDescription: "Please try again in a moment. If it keeps happening, share the error code below.",
    retry: "Try again",
    backToCalendar: "Back to calendar",
    errorCode: "Error code",
  },
};
