-- AI 대화(Task 009): 대화 저장(마지막 대화 후 30일 보관)과 사용자별 사용량 제한.
-- 적용 방법: Supabase 대시보드의 SQL 에디터에 붙여 넣어 실행하거나 `supabase db push`.

-- 대화. (날짜 범위 컬럼은 20261027000000_ai_chat_floating.sql에서 제거된다.)
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_range check (end_date >= start_date and end_date - start_date < 31),
  constraint ai_conversations_title check (char_length(title) between 1 and 100)
);

create index ai_conversations_user_updated_idx on public.ai_conversations (user_id, updated_at desc);
create index ai_conversations_updated_idx on public.ai_conversations (updated_at);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- 메시지가 쌓이면 대화의 마지막 활동 시각을 갱신한다(보관 30일의 기준).
-- 사용자에게는 대화 update 권한이 없으므로 definer로 실행한다.
create function public.ai_touch_conversation() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger ai_messages_touch_conversation
after insert on public.ai_messages
for each row execute function public.ai_touch_conversation();

-- 사용량 기록. 정책이 없어 사용자는 직접 읽거나 쓸 수 없고, 아래 함수로만 늘어난다.
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_requests_user_created_idx on public.ai_requests (user_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_requests enable row level security;

-- 로그인 전(anon)에는 어떤 권한도 주지 않는다.
revoke all on public.ai_conversations, public.ai_messages, public.ai_requests from anon;

-- 대화: 본인 것 중 마지막 활동이 30일 이내인 것만 보인다. 대화 수정(update) 정책은 없다.
create policy "ai_conversations: 본인 조회(30일 이내)" on public.ai_conversations
  for select to authenticated
  using ((select auth.uid()) = user_id and updated_at > now() - interval '30 days');

create policy "ai_conversations: 본인 생성" on public.ai_conversations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "ai_conversations: 본인 삭제" on public.ai_conversations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 메시지: 보이는 대화(위 정책의 30일 조건 포함)의 것만 보고, 본인 대화에만 쓴다. 삭제는 대화 삭제의 cascade로만 한다.
create policy "ai_messages: 보이는 대화의 메시지 조회" on public.ai_messages
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id)
  );

create policy "ai_messages: 본인 대화에 생성" on public.ai_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id)
  );

-- 30일 지난 대화 정리. 모든 사용자의 대화를 지우므로 사용자에게는 열어 주지 않는다
-- (사용량 함수가 호출 때마다 일부를 정리하고, 일 1회 스케줄은 Task 010의 pg_cron으로 건다).
create function public.purge_expired_ai_chats(p_batch int default 500) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with doomed as (
    select id from public.ai_conversations
    where updated_at <= now() - interval '30 days'
    limit greatest(p_batch, 1)
  )
  delete from public.ai_conversations c using doomed d where c.id = d.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_expired_ai_chats(int) from public, anon, authenticated;

-- 질문 1건을 한도 안에서 기록한다. 한도 이내면 true, 넘으면(또는 로그인하지 않았으면) false.
-- 최근 1시간·24시간(롤링) 건수를 세며, 사용자별 락으로 동시 요청이 한도를 넘지 못하게 직렬화한다.
create function public.consume_ai_quota(p_hour_limit integer, p_day_limit integer) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hour integer;
  v_day integer;
  v_hour_limit integer := least(greatest(coalesce(p_hour_limit, 0), 0), 100);
  v_day_limit integer := least(greatest(coalesce(p_day_limit, 0), 0), 500);
begin
  if v_uid is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  delete from public.ai_requests where user_id = v_uid and created_at < now() - interval '2 days';

  select
    count(*) filter (where created_at > now() - interval '1 hour'),
    count(*)
  into v_hour, v_day
  from public.ai_requests
  where user_id = v_uid and created_at > now() - interval '1 day';

  if v_hour >= v_hour_limit or v_day >= v_day_limit then
    return false;
  end if;

  insert into public.ai_requests (user_id) values (v_uid);
  perform public.purge_expired_ai_chats(100);
  return true;
end;
$$;

revoke all on function public.consume_ai_quota(integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(integer, integer) to authenticated;
