-- 게스트가 로그아웃하면 그 게스트의 계정과 데이터를 바로 지운다(Task 014).
-- 익명 계정은 로그아웃 뒤 다시 로그인할 방법이 없어 남는 데이터는 아무도 볼 수 없다.
-- 일정·알림·AI 대화·사용량 기록 등 하위 데이터는 FK의 on delete cascade로 함께 지워진다.
-- 브라우저를 닫거나 쿠키를 지워 로그아웃 없이 버려진 게스트는 purge_inactive_guests(30일)가 정리한다.
-- 적용 순서: 20261028000000_guest_mode.sql 다음.

-- 호출한 본인(auth.uid())의 익명 계정만 지운다. 일반 계정은 JWT가 아니라 auth.users 행의 is_anonymous로 다시 확인해 절대 지우지 않는다.
create function public.delete_guest_account() returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    return false;
  end if;

  delete from auth.users where id = v_uid and is_anonymous;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.delete_guest_account() from public, anon;
grant execute on function public.delete_guest_account() to authenticated;
