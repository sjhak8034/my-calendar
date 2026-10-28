-- 알림 예약·발송 준비(Task 010).
-- 일정이 저장·수정되면 DB 트리거가 시작 10분 전·종료 시각 알림 행을 만들고, 발송 워커는 claim_due_notifications로
-- 보낼 행을 원자적으로 선점한다(중복 발송 방지). 적용 순서: 앞선 마이그레이션 다음.

-- 상태에 sending(워커가 선점함)과 skipped(보내지 않음: 채널 미연결·시각 초과 등)를 더한다.
alter table public.notifications drop constraint notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));
alter table public.notifications add column claimed_at timestamptz;

-- 일정이 저장되면 알림을 예약한다. 종일 일정은 제외하고, 이미 지난 시각의 알림은 만들지 않는다.
-- 시작·종료·종일 여부가 바뀌면 기존 알림(발송된 것 포함)을 지우고 새 시각으로 다시 만든다.
-- 제목·설명 등만 바뀐 수정은 건드리지 않는다. 채널(web_push, kakao)별로 한 행씩 만들고,
-- 사용자가 그 채널을 연결하지 않았다면 발송 시점에 skipped 처리된다.
create function public.schedule_event_notifications() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.start_at = old.start_at and new.end_at = old.end_at and new.all_day = old.all_day then
      return new;
    end if;
    delete from public.notifications where event_id = new.id;
  end if;

  if new.all_day then
    return new;
  end if;

  insert into public.notifications (user_id, event_id, kind, channel, send_at)
  select new.user_id, new.id, k.kind, c.channel, k.send_at
  from (values ('start', new.start_at - interval '10 minutes'), ('end', new.end_at)) as k (kind, send_at)
  cross join (values ('web_push'), ('kakao')) as c (channel)
  where k.send_at > now()
  on conflict (event_id, kind, channel) do nothing;

  return new;
end;
$$;

revoke all on function public.schedule_event_notifications() from public, anon, authenticated;

create trigger events_schedule_notifications
after insert or update of start_at, end_at, all_day on public.events
for each row execute function public.schedule_event_notifications();

-- 이미 있는 앞으로의 일정에도 알림을 예약한다.
insert into public.notifications (user_id, event_id, kind, channel, send_at)
select e.user_id, e.id, k.kind, c.channel,
       case k.kind when 'start' then e.start_at - interval '10 minutes' else e.end_at end
from public.events e
cross join (values ('start'), ('end')) as k (kind)
cross join (values ('web_push'), ('kakao')) as c (channel)
where not e.all_day
  and case k.kind when 'start' then e.start_at - interval '10 minutes' else e.end_at end > now()
on conflict (event_id, kind, channel) do nothing;

-- 보낼 시각이 된 알림을 최대 p_limit개 선점해 일정 정보와 함께 돌려준다.
-- for update skip locked + status 전환으로 워커가 동시에 여러 개 떠도 한 알림은 한 번만 선점된다.
-- 발송 시각에서 10분 넘게 늦은 알림은 보내지 않고 skipped(expired)로 닫고,
-- 선점 후 5분이 지나도 결과가 기록되지 않은 행(워커 중단)은 다시 pending으로 되돌린다.
-- service role(발송 워커)만 호출할 수 있다.
create function public.claim_due_notifications(p_limit integer default 50)
returns table (
  id uuid,
  user_id uuid,
  event_id uuid,
  kind text,
  channel text,
  send_at timestamptz,
  title text,
  start_at timestamptz,
  end_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications n
  set status = 'pending', claimed_at = null
  where n.status = 'sending' and n.claimed_at < now() - interval '5 minutes';

  update public.notifications n
  set status = 'skipped', error = 'expired'
  where n.status = 'pending' and n.send_at < now() - interval '10 minutes';

  return query
  with due as (
    select d.id
    from public.notifications d
    where d.status = 'pending' and d.send_at <= now()
    order by d.send_at
    limit least(greatest(coalesce(p_limit, 0), 1), 200)
    for update skip locked
  ),
  claimed as (
    update public.notifications n
    set status = 'sending', claimed_at = now()
    from due
    where n.id = due.id
    returning n.id, n.user_id, n.event_id, n.kind, n.channel, n.send_at
  )
  select c.id, c.user_id, c.event_id, c.kind, c.channel, c.send_at, e.title, e.start_at, e.end_at
  from claimed c
  join public.events e on e.id = c.event_id;
end;
$$;

revoke all on function public.claim_due_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(integer) to service_role;

-- 오래된 발송 기록 정리(보낸 지 30일 지난 sent·failed·skipped). 일 1회 스케줄은 supabase/cron/schedule.sql.
create function public.purge_old_notifications(p_batch integer default 500) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with doomed as (
    select n.id from public.notifications n
    where n.status in ('sent', 'failed', 'skipped') and n.send_at < now() - interval '30 days'
    limit greatest(p_batch, 1)
  )
  delete from public.notifications n using doomed d where n.id = d.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_old_notifications(integer) from public, anon, authenticated;
