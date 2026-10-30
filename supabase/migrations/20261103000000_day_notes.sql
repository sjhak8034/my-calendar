-- 날짜별 메모. 주간 화면 머리글의 날짜를 누르면 열리는 팝업에서 쓰고, 월간 날짜 칸·주간 머리글에 메모 아이콘이 붙는다.
-- 사용자·날짜(서울 기준)마다 한 개다. 내용을 비우고 저장하면 서버 코드가 행을 지운다(빈 메모는 저장하지 않는다).
-- 트리거·함수는 쓰지 않는다: 길이는 CHECK, 행 수 상한은 서버 코드(lib/notes/actions.ts)가 확인한다.
-- 개발·운영이 같은 DB라 적용하면 둘 다 바로 쓸 수 있다. 이 마이그레이션을 먼저 적용한 뒤 코드를 푸시한다.
--
-- 되돌리려면:
--   drop table public.day_notes;

create table public.day_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  content text not null check (char_length(content) between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.day_notes enable row level security;

-- 본인 메모만 읽고 쓴다(events와 같은 방식). 익명 키(anon 역할)로는 접근할 수 없다.
create policy "day_notes: 본인 데이터만" on public.day_notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.day_notes from anon;
