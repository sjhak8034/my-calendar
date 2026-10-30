-- 관리자 설정 저장 테이블. 통계는 DB 함수 없이 서버 코드(service role)가 직접 집계한다. 트리거·함수는 쓰지 않는다.
-- 운영 DB에 적용하기 전에 개발 DB에서 먼저 확인한다(현재 개발·운영이 같은 DB다).
--
-- 되돌리려면:
--   drop table public.app_settings;

-- 관리자가 화면에서 저장하는 설정(키-값). 지금은 AI 요금 단가('ai_pricing')만 쓴다.
-- 사용자 권한으로는 읽고 쓸 수 없다(정책 없음, 권한 회수): 서버가 service role로만 다룬다.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
