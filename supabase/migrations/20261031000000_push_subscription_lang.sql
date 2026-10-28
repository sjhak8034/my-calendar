-- 웹 푸시(Task 011). 발송 워커는 사용자의 언어를 모르므로 구독할 때의 화면 언어를 함께 저장해 알림 문구에 쓴다.
-- 기존 행은 기본 언어(ko)로 채워진다. RLS 정책은 init 마이그레이션의 "본인 데이터만"을 그대로 쓴다.
alter table public.push_subscriptions
  add column lang text not null default 'ko' check (lang in ('ko', 'en'));
