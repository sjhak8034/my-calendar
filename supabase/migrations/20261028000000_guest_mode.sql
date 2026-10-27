-- 게스트(익명 로그인) 모드(Task 014): 게스트의 AI 사용량을 DB에서 제한하고, 방치된 게스트 계정을 정리한다.
-- 적용 순서: 20261026000000_ai_chat.sql → 20261027000000_ai_chat_floating.sql → 이 파일.
-- 사전 설정: Supabase 대시보드 > Authentication > Sign In / Providers 에서 "Allow anonymous sign-ins"를 켠다.

-- 질문 1건을 한도 안에서 기록한다. 게스트(JWT의 is_anonymous)는 요청한 한도와 상관없이 시간당·하루 3회까지만 허용한다.
-- (앱 라우트를 거치지 않고 RPC를 직접 불러도 한도를 키울 수 없게 DB가 강제한다. "하루"는 일반 사용자와 같은 최근 24시간 롤링.)
create or replace function public.consume_ai_quota(p_hour_limit integer, p_day_limit integer) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_hour integer;
  v_day integer;
  v_hour_limit integer := least(greatest(coalesce(p_hour_limit, 0), 0), 100);
  v_day_limit integer := least(greatest(coalesce(p_day_limit, 0), 0), 500);
begin
  if v_uid is null then
    return false;
  end if;

  if v_guest then
    v_hour_limit := least(v_hour_limit, 3);
    v_day_limit := least(v_day_limit, 3);
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

-- 방치된 게스트 정리: 가입 후 30일이 지났고 최근 30일 안에 세션이 갱신되지 않은 익명 사용자를 지운다.
-- 일정·알림·AI 대화 등 하위 데이터는 FK의 on delete cascade로 함께 지워진다.
-- 모든 게스트에 영향을 주므로 사용자에게는 열어 주지 않는다(일 1회 스케줄은 Task 010의 pg_cron으로 건다).
create function public.purge_inactive_guests(p_batch int default 500) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with doomed as (
    select u.id
    from auth.users u
    where u.is_anonymous
      and u.created_at < now() - interval '30 days'
      and not exists (
        select 1 from auth.sessions s
        where s.user_id = u.id
          and coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '30 days'
      )
    limit greatest(p_batch, 1)
  )
  delete from auth.users a using doomed d where a.id = d.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_inactive_guests(int) from public, anon, authenticated;
