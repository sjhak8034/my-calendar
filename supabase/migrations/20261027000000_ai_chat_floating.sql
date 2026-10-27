-- AI 대화를 우하단 팝업 채팅으로 바꾸면서 날짜 범위를 없앤다(범위는 모델이 도구로 직접 조회한다).
-- 20261026000000_ai_chat.sql을 먼저 적용한 뒤 실행한다.
alter table public.ai_conversations drop constraint ai_conversations_range;
alter table public.ai_conversations drop column start_date;
alter table public.ai_conversations drop column end_date;
