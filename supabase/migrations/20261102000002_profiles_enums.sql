-- profiles.role·membership를 text + check 제약에서 enum 타입으로 바꾼다.
-- 앞선 마이그레이션(20261102000001)이 이미 적용된 DB를 위한 변환이라 새 파일로 둔다. 기존 행의 값('user'/'admin', 'free')은 그대로 유지된다.
--
-- 값을 늘릴 때(예: 등급 pro): alter type public.membership_tier add value 'pro';
--   (같은 트랜잭션 안에서 새 값을 바로 쓸 수 없으니, SQL 편집기에서 이 문장만 먼저 따로 실행한 뒤 사용한다.)
-- 값을 빼거나 이름을 바꾸려면 enum은 타입을 새로 만들어 컬럼을 옮겨야 한다(alter type ... rename value 는 이름 변경만 가능).
--
-- 되돌리려면(enum → text + check):
--   alter table public.profiles alter column role drop default, alter column membership drop default;
--   alter table public.profiles alter column role type text using role::text, alter column membership type text using membership::text;
--   alter table public.profiles alter column role set default 'user', alter column membership set default 'free';
--   alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin')),
--     add constraint profiles_membership_check check (membership ~ '^[a-z][a-z0-9_]{0,31}$');
--   drop type public.user_role; drop type public.membership_tier;

create type public.user_role as enum ('user', 'admin');
create type public.membership_tier as enum ('free');

-- 타입을 바꾸기 전에 text 기준의 check 제약과 기본값을 먼저 떼어 낸다(그대로 두면 변환이 실패한다).
alter table public.profiles
  drop constraint profiles_role_check,
  drop constraint profiles_membership_check,
  alter column role drop default,
  alter column membership drop default;

alter table public.profiles
  alter column role type public.user_role using role::public.user_role,
  alter column membership type public.membership_tier using membership::public.membership_tier;

alter table public.profiles
  alter column role set default 'user',
  alter column membership set default 'free';
