// AI 대화의 수치 한도. PRD·ROADMAP과 마이그레이션(20261026000000_ai_chat.sql)의 값과 함께 바꾼다.
export const AI_MAX_QUESTION_CHARS = 200; // 질문 1건(UTF-16 글자 수, textarea maxLength와 같은 기준)
export const AI_HOURLY_LIMIT = 20; // 사용자당 최근 1시간 질문 수
export const AI_DAILY_LIMIT = 100; // 사용자당 최근 24시간 질문 수
export const AI_HISTORY_MESSAGES = 10; // 모델에 이어 보내는 이전 메시지 수
export const AI_HISTORY_CHARS = 8000; // 이전 메시지 글자 합계(넘으면 오래된 것부터 뺀다)
export const AI_GUEST_LIMIT = 3; // 게스트(익명 로그인) 사용자의 시간당·하루 질문 수. 20261028000000_guest_mode.sql의 값과 함께 바꾼다.
export const AI_MAX_TOOL_ROUNDS = 5; // 질문 1건당 도구 호출을 거치는 모델 호출 상한(마지막 한 번은 도구 없이 답하게 한다)
export const AI_MAX_DRAFTS = 3; // 질문 1건당 일정 초안 수
export const AI_SEARCH_MAX_DAYS = 366; // search_events 한 번에 조회할 수 있는 최대 일수
export const AI_SEARCH_MAX_EVENTS = 50; // search_events 결과로 모델에 돌려주는 일정 수
export const AI_SEARCH_KEYWORD_CHARS = 50; // search_events 키워드 최대 길이
export const AI_DESCRIPTION_CHARS = 300; // 일정 설명 절단 길이
// 모델의 내부 추론 토큰도 출력 한도에 포함되므로 답변 길이보다 넉넉하게 둔다(1000이면 도구 호출이 있는 요청이 중간에 끊겼다).
export const AI_MAX_OUTPUT_TOKENS = 2500;
export const AI_REASONING_EFFORT = "low"; // 추론을 줄여 응답 속도와 비용을 낮춘다(none은 시간 계산 정확도가 걱정돼 low)
export const AI_RETENTION_DAYS = 30; // 마지막 대화 후 보관 기간
export const AI_DEFAULT_MODEL = "gemini-3.8-flash"; // GEMINI_MODEL 환경변수가 없을 때
