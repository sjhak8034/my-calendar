-- 알림 발송 워커 호출과 정리 작업의 스케줄(Task 010). 마이그레이션이 아니라 배포 후 한 번 직접 실행한다.
-- 배경: Vercel Hobby 플랜의 Cron은 하루 1회만 가능해서, Supabase pg_cron이 1분마다 Vercel의 /api/cron/notify를 호출한다.
-- 로컬 개발 서버는 외부에서 접근할 수 없으므로 개발 중에는 curl로 워커를 직접 호출한다(docs/ROADMAP.md Task 010 참고).
--
-- 사전 준비
--   1. Supabase 대시보드 > Database > Extensions 에서 pg_cron, pg_net 활성화
--   2. Vercel 환경변수에 CRON_SECRET(16자 이상 임의 문자열), SUPABASE_SERVICE_ROLE_KEY 등록
--   3. 아래 <...> 두 곳을 실제 값으로 바꿔 SQL 에디터에서 실행

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 비밀값은 코드가 아니라 Vault에 둔다.
select vault.create_secret('https://<배포한 도메인>', 'notify_base_url');
select vault.create_secret('<CRON_SECRET과 같은 값>', 'notify_cron_secret');

-- 1분마다 발송 워커 호출(응답을 기다리지 않는 비동기 요청, 타임아웃 10초)
select cron.schedule(
  'notify-due',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_base_url') || '/api/cron/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

-- 매일 03:00(KST, 18:00 UTC) 만료 데이터 정리
select cron.schedule(
  'purge-daily',
  '0 18 * * *',
  $$
  select public.purge_expired_ai_chats(1000);
  select public.purge_inactive_guests(1000);
  select public.purge_old_notifications(1000);
  $$
);

-- 되돌리기: select cron.unschedule('notify-due'); select cron.unschedule('purge-daily');
