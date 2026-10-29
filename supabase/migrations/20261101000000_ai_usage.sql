-- AI 질문별 토큰 사용량 기록(비용 확인용). 질문·답변 내용은 담지 않고 숫자만 둔다.
-- ai_requests는 사용량 "제한"을 세는 표라 2일 지난 행을 지우므로, 비용 집계용으로 따로 둔다.
-- 쓰기는 서버(service role)만 한다: RLS는 켜고 정책을 두지 않으며 사용자 권한도 모두 회수한다.
-- user_id는 계정을 삭제해도 비용 기록은 남도록 on delete set null(개인 식별이 사라진 숫자만 남는다).
--
-- 되돌리기:
--   drop function public.purge_old_ai_usage(integer);
--   drop table public.ai_usage;

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  is_guest boolean not null default false,
  model text not null,
  -- 질문 1건 동안의 모델 호출 수와, 그중 사용량이 도착한 호출 수(다르면 일부가 누락된 것).
  rounds smallint not null,
  usage_rounds smallint not null,
  prompt_tokens integer not null,
  completion_tokens integer not null,
  reasoning_tokens integer not null,
  total_tokens integer not null,
  created_at timestamptz not null default now()
);

create index ai_usage_created_idx on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- 오래된 기록 정리(90일). 서버가 기록할 때마다 조금씩 부른다.
create function public.purge_old_ai_usage(p_batch integer default 100) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with doomed as (
    select id from public.ai_usage
    where created_at < now() - interval '90 days'
    limit greatest(p_batch, 1)
  )
  delete from public.ai_usage a using doomed d where a.id = d.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_old_ai_usage(integer) from public, anon, authenticated;
grant execute on function public.purge_old_ai_usage(integer) to service_role;
