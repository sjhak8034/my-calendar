-- 카카오톡 알림(Task 012). 발송 워커는 사용자의 언어를 모르므로 연결할 때의 화면 언어를 저장해 알림 문구에 쓰고,
-- 리프레시 토큰이 만료·철회돼 더는 보낼 수 없을 때 needs_reconnect로 표시해 설정 화면이 재연결을 안내하게 한다.
-- 기존 RLS(정책 없음 = service role만 접근)는 그대로다. 토큰은 애플리케이션에서 암호화한 값만 저장한다.
alter table public.kakao_tokens
  add column lang text not null default 'ko' check (lang in ('ko', 'en')),
  add column needs_reconnect boolean not null default false;
