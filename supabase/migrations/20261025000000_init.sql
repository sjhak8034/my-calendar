-- my-calendar 초기 스키마. 모든 테이블은 user_id 기준 RLS로 본인 데이터만 접근한다.

create extension if not exists pgcrypto;

-- 일정
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  description text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (end_at >= start_at)
);

create index events_user_start_idx on public.events (user_id, start_at);
create index events_user_end_idx on public.events (user_id, end_at);

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- 알림 예약. 발송 상태 갱신은 서버(service role)가 한다.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('start', 'end')),
  channel text not null check (channel in ('web_push', 'kakao')),
  send_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  unique (event_id, kind, channel)
);

create index notifications_due_idx on public.notifications (send_at) where status = 'pending';
create index notifications_user_idx on public.notifications (user_id, send_at desc);

-- 웹 푸시 구독
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- 카카오 토큰. 애플리케이션에서 암호화한 값만 저장한다.
-- 정책을 두지 않아 브라우저(anon/authenticated)에서는 접근할 수 없고, service role만 읽고 쓴다.
create table public.kakao_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text not null,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.events enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.kakao_tokens enable row level security;

create policy "events: 본인 데이터만" on public.events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "notifications: 본인 조회" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "notifications: 본인 일정에만 예약" on public.notifications
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = (select auth.uid())
    )
  );

create policy "notifications: 본인 삭제" on public.notifications
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "push_subscriptions: 본인 데이터만" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
