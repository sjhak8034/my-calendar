-- 일정에 장소(location)와 링크(url) 추가. 운영 DB에 적용하기 전에 개발 DB에서 먼저 확인한다.
-- 새 컬럼은 null 허용이라 기존 행·기존 코드(컬럼을 모르는 이전 배포)에 영향이 없다. 마이그레이션을 먼저 적용한 뒤 코드를 푸시한다.
--
-- 되돌리려면:
--   alter table public.events drop constraint events_location_length, drop constraint events_url_format,
--     drop column location, drop column url;

alter table public.events
  add column location text,
  add column url text;

-- 직접 REST 호출로 앱 검증을 건너뛰어도 길이·형식은 DB가 막는다(기존 제약과 같이 not valid).
-- url은 http(s)만 허용한다(javascript: 같은 스킴이 링크로 저장되지 않게).
alter table public.events
  add constraint events_location_length check (location is null or char_length(location) <= 200) not valid,
  add constraint events_url_format
    check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')) not valid;
