-- 사용자 역할(role: 권한)과 멤버십 등급(membership: 요금제). 둘을 따로 둔다: 관리자 여부는 권한이고, 등급은 기능·한도 차이라서 서로 독립적으로 늘어난다.
-- (적용 전이라 이 파일을 그대로 고친다. 이미 적용했다면 새 마이그레이션으로 컬럼을 추가한다.)
-- 사용자 역할(관리자 구분). 운영 DB에 적용하기 전에 개발 DB에서 먼저 확인한다(현재 개발·운영이 같은 DB다).
-- 행이 없으면 일반 사용자('user')로 본다. 행은 앱 서버가 가입·로그인 때 만든다(lib/profile/ensure-profile.ts, service role). DB 트리거는 쓰지 않는다.
--
-- 되돌리려면:
--   drop table public.profiles;
--
-- 등급을 늘릴 때(예: pro): 코드의 등급 목록에 값을 추가하면 된다. membership은 형식만 검사해 새 등급에 마이그레이션이 필요 없다.
-- 등급 지정(SQL 편집기): update public.profiles set membership = 'pro' where user_id = (select id from auth.users where email = '...');
-- 권한 종류(role)를 늘리려면 아래 check 제약을 새 마이그레이션으로 교체한다.
--
-- 관리자 지정(SQL 편집기에서 직접. 앱에서는 역할을 바꿀 수 없다. 이메일을 본인 것으로 바꿔 실행):
--   insert into public.profiles (user_id, role)
--     select id, 'admin' from auth.users where email = '관리자@example.com'
--     on conflict (user_id) do update set role = 'admin';
-- 관리자 해제:
--   update public.profiles set role = 'user' where user_id = (select id from auth.users where email = '관리자@example.com');

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- auth.users.email의 복사본(관리자 화면에서 이메일로 찾고 보여 주기 쉽게). 원본은 auth.users이고 서버가 로그인·가입 때 맞춘다. 게스트는 null.
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  -- 멤버십 등급. 지금은 'free'뿐이다. 값 목록은 코드가 정하고 DB는 소문자 슬러그 형식만 확인한다.
  membership text not null default 'free' check (membership ~ '^[a-z][a-z0-9_]{0,31}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 로그인한 사용자는 자기 행만 읽을 수 있다(역할 확인용). 쓰기 정책은 두지 않는다:
-- 사용자가 자기 역할을 바꾸지 못하게 하고, 쓰기는 service role·SQL 편집기만 한다.
create policy "profiles: 본인 행만 읽기" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase 기본 권한은 anon·authenticated에게 모든 권한을 주므로 거둬들이고 읽기만 남긴다(RLS와 이중 방어).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
