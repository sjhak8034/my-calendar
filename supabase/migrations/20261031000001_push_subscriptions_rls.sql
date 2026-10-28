-- 웹 푸시(Task 011). 발송 워커는 구독의 endpoint로 서버에서 직접 요청을 보내므로,
-- 사용자가 PostgREST로 임의의 endpoint 행을 넣을 수 있으면 서버가 내부 주소로 요청하게 만들 수 있다(SSRF).
-- 저장은 호스트 허용 목록을 검증하는 Server Action(lib/push/actions.ts)이 service role로만 하도록,
-- 사용자에게는 본인 구독의 조회·삭제 권한만 남긴다.
drop policy "push_subscriptions: 본인 데이터만" on public.push_subscriptions;

create policy "push_subscriptions: 본인 조회" on public.push_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "push_subscriptions: 본인 삭제" on public.push_subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);
