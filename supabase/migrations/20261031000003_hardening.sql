-- 보안 하드닝(Task 013 4단계). 적용 순서: 앞선 마이그레이션 다음. 운영 DB에 적용하기 전에 개발 DB에서 먼저 확인한다.
--
-- 되돌리려면(정책·권한만 되돌릴 수 있고, 아래 새 테이블·함수는 drop으로 지운다):
--   create policy "notifications: 본인 일정에만 예약" on public.notifications
--     for insert to authenticated
--     with check ((select auth.uid()) = user_id
--       and exists (select 1 from public.events e where e.id = event_id and e.user_id = (select auth.uid())));
--   grant execute on function public.ai_touch_conversation() to public, anon, authenticated;
--   drop function public.rate_limit_hit(text, integer, integer);
--   drop table public.action_requests;
--   drop trigger events_limit_per_user on public.events;
--   drop function public.limit_events_per_user();
--   alter table public.events drop constraint events_title_length, drop constraint events_description_length,
--     drop constraint events_color_palette;

-- 1) 알림 행은 DB 트리거(events_schedule_notifications)와 발송 워커(service role)만 만든다.
--    사용자가 직접 넣을 수 있으면 channel·send_at·status를 마음대로 정해 자기 알림을 '발송됨'으로 막는 등 흐름을 어지럽힐 수 있고,
--    앱 코드는 사용자 권한으로 notifications에 insert하지 않는다(app/api/cron/notify는 service role, lib/notify/history는 조회만).
drop policy "notifications: 본인 일정에만 예약" on public.notifications;

-- 2) 트리거 함수는 트리거로만 쓰이므로 직접 실행할 수 있는 권한을 회수한다(트리거 발동에는 영향 없음).
revoke all on function public.ai_touch_conversation() from public, anon, authenticated;

-- 3) 호출 빈도 제한. 푸시·카카오 테스트 발송처럼 외부 서비스를 부르는 동작이 반복 호출로 쿼터를 쓰지 못하게 한다.
--    ai_requests와 같은 방식: 정책이 없어 사용자는 직접 읽거나 쓸 수 없고, 아래 함수로만 기록이 늘어난다.
create table public.action_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('push_test', 'kakao_test')),
  created_at timestamptz not null default now()
);

create index action_requests_user_kind_created_idx on public.action_requests (user_id, kind, created_at);

alter table public.action_requests enable row level security;
revoke all on public.action_requests from anon, authenticated;

-- 최근 p_window_seconds초 안에 p_kind 요청이 p_max개 미만이면 1건을 기록하고 true, 아니면(또는 로그인하지 않았으면) false.
-- 사용자별 락으로 동시 요청이 한도를 넘지 못하게 직렬화한다. 한도 값은 서버 액션이 정해 넘기며, 직접 불러도 자기 기록만 늘 뿐이다.
create function public.rate_limit_hit(p_kind text, p_max integer, p_window_seconds integer) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_max integer := least(greatest(coalesce(p_max, 0), 0), 100);
  v_window integer := least(greatest(coalesce(p_window_seconds, 1), 1), 86400);
begin
  if v_uid is null or p_kind is null or p_kind not in ('push_test', 'kakao_test') then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_kind, 0));

  delete from public.action_requests where user_id = v_uid and created_at < now() - interval '1 day';

  select count(*) into v_count
  from public.action_requests
  where user_id = v_uid and kind = p_kind and created_at > now() - make_interval(secs => v_window);

  if v_count >= v_max then
    return false;
  end if;

  insert into public.action_requests (user_id, kind) values (v_uid, p_kind);
  return true;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon;
grant execute on function public.rate_limit_hit(text, integer, integer) to authenticated;

-- 4) 일정 입력 제한을 DB에서도 강제한다. 앱(lib/events/input.ts, lib/calendar/colors.ts)이 같은 값으로 이미 검증하지만,
--    publishable key는 공개 값이라 로그인한 사용자(게스트 포함)가 REST로 events에 직접 넣으면 앱 검증을 거치지 않는다.
--    not valid: 이미 저장된 행은 검사하지 않고 새 행과 수정에만 적용해, 기존 데이터가 어겨도 마이그레이션이 실패하지 않게 한다.
--    기존 데이터를 확인한 뒤 alter table public.events validate constraint <이름>; 으로 전체 검증할 수 있다.
alter table public.events
  add constraint events_title_length check (char_length(title) <= 100 and char_length(btrim(title)) >= 1) not valid,
  add constraint events_description_length check (description is null or char_length(description) <= 2000) not valid,
  add constraint events_color_palette
    check (color is null or color in ('gray', 'blue', 'indigo', 'purple', 'pink', 'orange', 'yellow', 'green')) not valid;

-- 5) 사용자당 일정 수 상한(10,000개). 직접 REST 호출로 일정을 끝없이 넣어 저장 공간을 쓰지 못하게 한다.
--    일정 추가 때마다 알림 행도 함께 만들어지므로 같이 막는 효과가 있다. 사용자별 락으로 동시 삽입이 상한을 넘지 못하게 한다.
--    RLS 때문에 호출자 본인의 행만 세어지고, user_id가 같은 행만 세므로 결과는 같다.
create function public.limit_events_per_user() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':events', 0));
  if (select count(*) from public.events where user_id = new.user_id) >= 10000 then
    raise exception 'events_limit_exceeded' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.limit_events_per_user() from public, anon, authenticated;

create trigger events_limit_per_user
before insert on public.events
for each row execute function public.limit_events_per_user();
