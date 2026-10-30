-- 일별 로그인 횟수. 서버 코드(lib/profile/record-login.ts)가 로그인할 때마다 그날의 횟수를 1 올린다. 트리거·함수는 쓰지 않는다.
-- 사용자·날짜(서울 기준)마다 한 행이다. 운영 DB에 적용하기 전에 개발 DB에서 먼저 확인한다(현재 개발·운영이 같은 DB다).
--
-- 되돌리려면:
--   drop table public.daily_logins;

create table public.daily_logins (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 1 check (count >= 1),
  primary key (user_id, day)
);

-- 기간별 조회용(관리자 대시보드가 날짜 범위로 읽는다).
create index daily_logins_day_idx on public.daily_logins (day);

-- 사용자 권한으로는 읽고 쓸 수 없다(정책 없음, 권한 회수): 서버가 service role로만 다룬다.
alter table public.daily_logins enable row level security;
revoke all on public.daily_logins from anon, authenticated;
