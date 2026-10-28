# my-calendar ROADMAP

월간 캘린더, 날짜별 시간 상세, 날짜 범위 AI 대화, 시작·종료 알림(웹 푸시 + 카카오톡)을 만드는 개발 로드맵. 요구사항은 `docs/PRD.md`를 따른다.

**📅 최종 업데이트**: 2026-10-28
**📊 진행 상황**: 11/13 Tasks 완료 (Task 009 AI 대화 1~3단계 완료·마무리 점검 대기, Task 010 알림 워커 완료, Task 011 웹 푸시 완료, Task 012 카카오톡 알림 완료, Task 014 게스트 모드 014a 완료·014b 구현)

## 착수 전 결정 사항

- AI 대화 사용량 제한(시간당 20회, 하루 100회)·메시지 200자·대화 30일 보관·쓰기 작업은 확인 버튼 필수: 확정(Task 009)
- 종일 다일 일정의 종료일 포함 여부와 입력 폼의 종료<시작 검증 메시지: Task 008 전 (확정됨: 주 시작 월요일, 6주 고정, 한 칸 3줄, 색 팔레트 8종)
- Vercel Cron / Supabase `pg_cron`·`pg_net` 요금제별 제한 확인: Task 010 전 (확인됨: Vercel Hobby는 Cron 하루 1회라 `pg_cron`으로 호출, `pg_net` 기본 타임아웃 5초라 10초 지정. Supabase 플랜별 `pg_cron` 사용 가능 여부는 대시보드에서 확장 활성화 시 확인)
- 카카오 `talk_message` 동의 항목의 다중 사용자 제공 조건(검수 여부): Task 012 전 (미확인: 공식 문서에서 "나에게 보내기"의 심사 요건을 찾지 못함. 앱 소유자 계정으로는 심사 없이 동의·발송되는 것을 확인했고, 다른 사용자는 Task 013 배포 전에 콘솔의 동의항목 화면과 문의로 확인)
- Next.js 16의 인증 확인 위치는 `node_modules/next/dist/docs/` 확인 후 결정: Task 003 전

## 개발 단계

### Phase 1: 프로젝트 기반 ✅

- **Task 001: 초기 템플릿 정리 및 프로젝트 설정** ✅ - 완료
  - ✅ `create-next-app` 데모 콘텐츠와 미사용 `public/` 에셋 제거
  - ✅ `README.md`를 캘린더 프로젝트 설명으로 교체
  - ✅ 루트 레이아웃·전역 스타일 확인(한국어 `lang`, 폰트, `.dark` 테마 토큰)
  - ✅ `npm run lint`, `npm run build` 통과 확인
- **Task 002: Supabase 프로젝트·스키마·RLS 구성** ✅ - 완료
  - ✅ Supabase 프로젝트 생성과 로컬 환경변수 구성(`.env`)
  - ✅ `lib/supabase/` 서버·클라이언트 생성기(`@supabase/ssr`)
  - ✅ 테이블 생성: `events`, `notifications`(channel, status 포함), `push_subscriptions`, `kakao_tokens` (마이그레이션 적용 확인)
  - ✅ 모든 테이블에 `user_id` + RLS 정책 적용 (계정 2개로 접근 분리·제약 검증 완료)
- **Task 003: 인증 (이메일 + Google) 및 접근 제어** ✅ - 완료
  - ✅ 로그인 페이지(`/[lang]/login`): 이메일 가입·로그인, Google 로그인 버튼, 시안 기반 디자인
  - ✅ 비로그인 시 로그인·개인정보처리방침 외 모든 페이지에서 `/[lang]/login`으로 이동
  - ✅ 로그아웃, 로그인 실패 오류 메시지
  - ✅ 한국어/영어 언어 선택(지구본 메뉴, URL의 `[lang]`, 사전 기반)
  - ✅ 앱 공통 레이아웃(상단 바: 로고, 이메일, 언어 선택, 로그아웃). AI 대화·설정 메뉴는 해당 페이지 Task에서 추가
  - ✅ 로그인 직후 인트로: 로그인(이메일·가입·Google)은 빈 환영 페이지 `/[lang]/welcome`으로 보내고, 언어 레이아웃의 오버레이가 `public/Welcome.svg`(SMIL 손글씨 애니메이션)를 보여 주는 동안 뒤에서 캘린더(또는 `next`)로 이동해 렌더링·데이터 로딩을 끝낸다. 환영 페이지는 서버 HTML이 배경뿐이라 풀 로드에서도 캘린더가 먼저 비치지 않음. 약 3.9초 뒤 자동으로 사라지며, 건너뛰기 버튼·화면 클릭·Esc/Enter/Space로 즉시 넘어갈 수 있음(시작 0.7초 뒤부터)
  - ✅ Google 로그인 동작 확인: OAuth 클라이언트 등록, Google 로그인 화면 이동은 자동 확인, 계정 선택 후 앱 복귀는 사용자가 브라우저에서 확인
- **Task 004: 날짜 유틸 및 공통 UI 컴포넌트** ✅ - 완료
  - ✅ `lib/calendar/` 순수 함수: 6주 고정 월 그리드(월요일 시작), 주 단위 분할, 레인 배정, 날짜 비교·포맷(`Asia/Seoul`, `Date` 변이 금지, 현재 시각은 인자로 받음)
  - ✅ 월 경계·윤년 수동 검증 목록(`docs/calendar-verification.md`)과 확인 스크립트 151건, 시간대 4곳 통과
  - ✅ shadcn 컴포넌트 추가: dialog, textarea, switch, sheet
- **Task 005: 월간 캘린더 보기 (F004)** ✅ - 완료
  - ✅ 앱 셸: 좌측 사이드바(로고, 메뉴, 사용자 카드), 모바일은 상단 바 + 메뉴 시트
  - ✅ 월 그리드(6주 × 7일), 요일 헤더, 날짜 배지·월 제목 툴바, 이전/다음/오늘 이동, `?month=YYYY-MM`(없거나 잘못된 값은 오늘 달로 redirect해 주소 통일)
  - ✅ 날짜 칸 링크 `/[lang]/day/YYYY-MM-DD` (대상 페이지는 Task 007에서 생성)
  - ✅ 접근성(`role="grid"`, `aria-current="date"`, `<time>`, 날짜 링크 aria-label)과 모바일 반응형. ARIA 격자 구조·탭 순서 개선은 Task 013
- **Task 006: 다일 일정 막대 (F005)** ✅ - 완료
  - ✅ 여러 날 일정을 주 단위로 분할해 막대로 표시, 주를 넘기면 이어서 표시
  - ✅ 겹치는 일정의 레인 배정(한 칸 최대 3줄), 일정 색 팔레트 8종
  - ✅ 칸 한도 초과 시 "N개 더 보기"(모바일은 "+N") 링크
- **Task 007: 날짜 상세 = 7열 주간 화면 (F006)** ✅ - 완료
  - ✅ `/[lang]/day/YYYY-MM-DD` 페이지: 그 날짜가 속한 주(월요일 시작)의 7열 시간 그리드, 선택한 날짜 열 강조, 잘못된 날짜는 404 화면
  - ✅ 06~24시 시간 눈금, 종일 줄, "6시 이전" 줄, 일정 색 블록, 겹치는 일정의 컬럼 분할, 자정을 넘는 일정 분할과 위·아래 이어짐 표시, 현재 시각 점선
  - ✅ 일정 블록 클릭 시 읽기 전용 상세 대화상자(제목, 시간 범위, 설명)
  - ✅ 이전/다음 주(범위 끝은 비활성), 오늘, 월간 보기 이동. 헤더·종일 줄·시간 눈금 열 고정, 모바일 가로 스크롤
  - ✅ 화면에 보이는 요일·월·날짜 제목을 영어 3글자 약어로 통일(월간 화면 포함)
- **Task 008: 일정 생성·수정·삭제 (F007~F009)** ✅ - 완료
  - ✅ `lib/events/input.ts`: 입력 검증·변환 순수 함수(제목 100자, 설명 2000자, 종료<시작 거부, 색 8종). 종료는 입력한 종료일·종료 시각 그대로 저장
  - ✅ `lib/events/actions.ts`: `createEvent`·`updateEvent`·`deleteEvent` Server Action(로그인 확인, 서버 재검증, RLS로 걸러진 행은 `notFound`, `revalidatePath`로 화면 갱신)
  - ✅ 주간 화면 오른쪽 사이드바(비모달) 폼: 제목, 종일, 시작·종료 날짜·시각, 색상 8종, 설명, 삭제 전 확인. 작은 화면은 아래 시트
  - ✅ "일정 추가" 또는 빈 시간대 클릭 → 그리드에 초안 블록이 생기고, 끌어서 요일·시간 이동, 위·아래 가장자리를 끌어 길이 조절(15분 스냅), 사이드바 입력과 양방향 동기화
  - ✅ 저장된 시간 일정도 끌어서 이동·크기 조절, 놓는 즉시 저장(실패하면 원위치 + 오류 알림).
  - ✅ 일정을 끌면 화면 아래에 X 삭제 영역이 나타나고, 놓으면 확인 없이 즉시 삭제(낙관적 삭제, 실패 시 복원 + 알림). 사이드바 초안을 X에 놓으면 초안을 버리고 사이드바를 닫음
  - ✅ 끌기 이동·크기 조절은 시각만 갱신하는 `moveEvent` Action으로 저장(다른 필드는 건드리지 않음)
  - ✅ 끌어 놓으면 낙관적 업데이트로 새 위치가 즉시 반영되고 저장은 뒤에서 진행(실패 시 원위치 + 알림), 저장 후 무효화는 주간·월간 페이지로 한정
  - ✅ 월간 "일정 추가" → 오늘이 속한 주간 화면에서 사이드바 열림(`?new=1`)
  - ✅ `lib/calendar/drag.ts` 확인 스크립트 통과, `npm run lint`, `npm run build` 통과
  - ✅ 브라우저 수동 확인: 끌기·크기 조절·즉시 저장 동작 확인
  - 제한: 종일 막대·"6시 이전" 칩·자정을 넘는 일정은 끌 수 없고 사이드바 입력으로 수정. 저장된 일정의 터치 이동은 지원하지 않음(초안과 크기 핸들은 터치 가능)

### Phase 3: AI 대화

- **Task 009: AI 대화 — 우하단 팝업 채팅 + 도구 호출 (F010)** - 우선순위
  - **1단계(구현·일정 검색 동작 확인)**: 읽기 전용
    - 앱 공통 레이아웃의 오른쪽 아래 둥근 버튼(`components/ai/ai-widget.tsx`, 아이콘은 `ToggleIcon` 한 곳만 교체)과 채팅 팝업(작은 화면은 전체 화면). `/ai` 페이지와 사이드바 메뉴 제거
    - 이어지는 단일 대화(열면 최근 30일 이내 대화 복원) + 새 대화·기록 전체 삭제. 메시지 200자
    - `app/api/ai/route.ts`: 로그인·Origin·입력 검증 후 `consume_ai_quota` 통과 시 Gemini(OpenAI 호환 엔드포인트) 호출, NDJSON 스트리밍. 질문 1건당 모델 호출은 도구 루프로 최대 5회(`AI_MAX_TOOL_ROUNDS`), 마지막 호출은 도구 없이 답하게 함
    - `lib/ai/tools.ts`: `search_events(start_date, end_date, keyword?)` — 로그인 사용자의 Supabase 클라이언트로 조회(RLS), 최대 366일·50건, 인자는 서버에서 재검증. 결과는 `<` 이스케이프한 JSON, 시스템 프롬프트로 데이터와 지시를 구분(프롬프트 인젝션 방어)
    - Gemini 3 도구 호출은 `extra_content`(thought signature)를 다음 요청에 그대로 돌려줘야 해서 `lib/ai/sse.ts`의 `ToolCallAssembler`가 보존
  - **2단계(구현·검증됨)**: `create_event` 도구. 모델은 일정을 저장하지 못하고 검증을 통과한 초안만 만든다(`lib/ai/tools.ts`, `toPayload` 재사용, 질문당 최대 3개). 채팅창에 초안 카드(제목·시간·색)가 뜨고 사용자가 "추가" 버튼을 눌러야 기존 `createEvent` Server Action으로 저장(로그인·입력 재검증·`revalidatePath`). 카드는 대화에 저장되지 않아 새로고침하면 사라짐
  - **3단계(구현·검증됨)**: `update_event`·`delete_event` 도구. 대상은 `search_events`가 준 id로 지정하고 서버가 본인 일정을 다시 읽어 변경 전/후(시작만 옮기면 길이 유지)를 만든다. 수정·삭제 카드의 버튼을 눌러야 기존 `updateEvent`·`deleteEvent` Server Action이 실행. 추가·수정·삭제 카드는 질문당 합쳐 3개까지(`lib/ai/draft.ts`의 `AiDraft`)
  - 보안 방어 현황과 남은 점검(RLS 실검증, 공격 시나리오, 쓰기 도구 도입 시 규칙)은 `docs/ai-security.md`에 정리
  - 모델 내부 추론 토큰도 출력 한도에 포함되므로 `max_completion_tokens` 2500 + `reasoning_effort: low`(1000에서는 검색 후 수정 같은 다단계 요청이 "답변이 길어 중간에 끊겼어요"로 잘림)
  - API 키는 서버 환경변수(`GEMINI_API_KEY`, 선택 `GEMINI_MODEL`)에만 보관. 질문·답변은 DB에 저장하고 마지막 대화 후 30일 보관(RLS가 만료 대화를 숨기고 삭제 함수로 정리)
  - ⚠️ 적용 필요(순서대로): `supabase/migrations/20261026000000_ai_chat.sql` → `20261027000000_ai_chat_floating.sql`(날짜 범위 컬럼 제거)을 Supabase에 실행해야 동작. 만료 행 완전 삭제는 사용량 함수가 호출 때마다 일부를 정리하고, 일 1회 스케줄은 Task 010의 `pg_cron`에 추가

### Phase 3-1: 게스트 모드

- **Task 014: 게스트(익명 로그인) 모드 (F015, F016)** - 우선순위
  - **014a(완료)**: 게스트 시작·AI 3회 제한·로그아웃 확인·로그아웃 시 즉시 삭제를 REST와 브라우저로 확인
    - 로그인 화면의 "게스트로 시작" → `signInAsGuest` Server Action이 `auth.signInAnonymously()` 후 `/welcome`으로 이동. 게스트도 `authenticated` 역할 + `is_anonymous` claim이라 RLS·일정 CRUD·`proxy.ts`는 그대로 동작
    - 게스트 AI는 최근 24시간 3회(시간당도 3회). `consume_ai_quota`가 JWT의 `is_anonymous`를 읽어 DB에서 한도를 3으로 clamp(RPC를 직접 불러도 우회 불가), 라우트는 같은 값을 넘기고 `guestLimited` 오류를 돌려줌
    - 사용자 카드에 "게스트" 표시, 게스트 로그아웃은 확인 대화상자(`components/app-shell/guest-sign-out.tsx`) 후 **계정·데이터 즉시 삭제**: `signOut` Server Action이 게스트면 `delete_guest_account()` RPC(본인 익명 계정만, `auth.users.is_anonymous` 재확인, FK cascade)를 호출한 뒤 로그아웃. 실패해도 로그아웃은 진행하고 30일 정리가 안전망
    - `purge_inactive_guests`: 가입 30일 경과 + 최근 30일 세션 갱신이 없는 익명 사용자를 삭제(FK cascade로 하위 데이터 정리). 일 1회 스케줄은 Task 010의 `pg_cron`에 추가
  - **014b(구현됨, UI 검증 대기)**: 게스트 → 정식 계정 전환. 사용자 카드의 "계정 만들기" → `/[lang]/upgrade`(게스트만 접근, 아니면 홈으로). 이메일은 `upgradeWithEmail`(`updateUser({email, password})` 후 `refreshSession`)로 같은 `user.id`를 유지하고, Google은 `upgradeWithGoogle`(`linkIdentity`) → `/auth/callback?upgrade=1`이 인트로 없이 홈으로 보냄. 이미 다른 계정에 연결된 Google 계정(`identity_already_exists`)은 `/upgrade?error=identity` 안내. 두 액션 모두 서버에서 게스트인지 재확인. 이메일 확인이 꺼진 프로젝트라 즉시 전환됨(켜져 있으면 "확인 메일" 안내)
  - ⚠️ 적용 필요: Supabase 대시보드에서 **Allow anonymous sign-ins** 켜기(014b에서 Google 연결은 **Manual linking**도), `supabase/migrations/20261028000000_guest_mode.sql` → `20261029000000_guest_delete.sql` 실행(앞선 AI 마이그레이션 두 개가 먼저 적용돼 있어야 함)
  - 남는 위험: CAPTCHA 없음(Supabase 기본 익명 가입 IP 제한에 의존). 게스트당 하루 3회라 비용은 제한적이며 필요하면 Turnstile을 후속으로 추가

### Phase 4: 알림

- **Task 010: 알림 예약 및 발송 워커 (F011, F014)** ✅ - 완료(마이그레이션 적용·워커 로컬 검증)
  - **예약은 DB 트리거**(`events_schedule_notifications`, `20261030000000_notifications.sql`): 일정 저장 시 시작 10분 전·종료 시각 알림을 채널(`web_push`, `kakao`)별로 한 행씩 만든다. 종일 일정과 이미 지난 시각은 제외. 시작·종료·종일이 바뀌면 기존 알림(발송된 것 포함)을 지우고 새 시각으로 다시 만들어 일정을 옮기면 다시 알린다(제목·설명만 바꾸면 그대로). 삭제는 FK cascade. 앱 코드(직접 편집·드래그·AI 카드)가 어떤 경로로 저장해도 같은 규칙. 앞으로 있는 기존 일정은 마이그레이션이 백필
  - **발송 워커** `app/api/cron/notify/route.ts`(POST): `Authorization: Bearer CRON_SECRET`(타이밍 안전 비교, 16자 미만이면 503)로 인증하고 service role 클라이언트(`lib/supabase/admin.ts`)로 `claim_due_notifications`를 호출. `proxy.ts`는 `/api/cron/*`만 로그인 검사에서 제외
  - **중복 발송 방지**: `claim_due_notifications`가 `for update skip locked`로 보낼 행을 `sending`으로 원자적으로 선점해 워커가 동시에 떠도 한 알림은 한 번만 처리. 결과는 `status='sending'` 조건으로 기록. 선점 후 5분 넘게 결과가 없으면 `pending`으로 되돌리고(워커 중단 복구), 발송 시각에서 10분 넘게 늦은 알림은 보내지 않고 `skipped(expired)`
  - **채널**: `lib/notify/dispatch.ts`의 `dispatchNotification`. 웹 푸시(Task 011)는 발송하고, 카카오톡(Task 012) 전까지는 `skipped(channel_not_ready)`로 닫는다. 새 상태 `sending`·`skipped`를 추가
  - **스케줄**: Vercel Hobby의 Cron은 하루 1회라 1분 간격이 불가 → Supabase `pg_cron` + `pg_net`이 1분마다 Vercel의 `/api/cron/notify`를 호출(`supabase/cron/schedule.sql`, 비밀값은 Vault). 같은 파일에 일 1회(03:00 KST) 정리 작업 `purge_expired_ai_chats`·`purge_inactive_guests`·`purge_old_notifications`도 등록. 배포 주소가 필요해 Task 013 배포 후 실행, 로컬은 curl로 워커를 직접 호출
  - ⚠️ 적용 필요: `supabase/migrations/20261030000000_notifications.sql` 실행, `.env`에 `SUPABASE_SERVICE_ROLE_KEY`·`CRON_SECRET` 추가(배포 시 Vercel에도 등록)
- **Task 011: 웹 푸시 알림 (F012)** ✅ - 완료(구독·테스트 알림·실제 일정 알림 브라우저 확인)
  - **서비스 워커** `public/sw.js`: `push`에서 항상 알림을 띄우고(`userVisibleOnly`), `notificationclick`에서 같은 사이트의 열린 탭을 재사용하거나 새 탭을 연다. `next.config.ts`가 `/sw.js`에 `no-cache`를 붙인다. 오프라인 캐시는 없다
  - **설정 페이지** `/[lang]/settings`(`components/settings/push-toggle.tsx`): 스위치로 이 브라우저의 구독을 켜고 끈다(권한 요청은 스위치를 누를 때만). 미지원·차단됨 안내, 열 때 서버에 구독 재저장(만료 정리·언어 변경 반영), VAPID 키가 바뀌면 구독을 새로 만듦, "테스트 알림 보내기" 버튼. 사이드바·모바일 메뉴의 "설정"이 실제 링크가 됨
  - **구독 저장** `lib/push/`: `subscribePush`·`unsubscribePush`·`sendTestPush` Server Action. `endpoint`는 https이고 FCM·Mozilla·Windows·Apple 푸시 서비스 호스트만 허용(서버가 그 주소로 직접 요청하므로 SSRF 방지), 키 형식·길이 검증, 사용자당 10개 상한. 다른 계정이 쓰던 `endpoint`는 service role로 소유자를 옮김
  - **발송** `lib/notify/web-push.ts`: 사용자의 모든 구독에 병렬 발송(TTL 10분, 요청 타임아웃 5초), 구독마다 저장된 `lang`으로 문구 생성(`notify.*` 사전). 404·410은 구독을 지움. 결과: 하나라도 성공 `sent`, 전부 실패 `failed`(`http_403` 등), 구독 없음·전부 만료 `skipped(no_subscription·subscription_expired)`, VAPID 설정 없음 `failed(push_not_configured)`. 발송 직전에 호스트 허용 목록을 다시 검사하고, 구독 주소는 로그에 남기지 않음
  - **RLS 강화**: 사용자는 본인 구독의 조회·삭제만 가능하고 저장은 Server Action(service role)으로만 한다. 사용자가 PostgREST로 임의의 `endpoint` 행을 넣어 서버가 내부 주소로 요청하게 만드는 경로를 막음
  - 알림을 누르면 해당 날짜의 주간 화면이 열린다. 문구: `10분 뒤 시작해요 · 시간 범위` / `일정이 끝났어요 · 시간 범위`
  - ⚠️ 적용 필요(순서대로): `supabase/migrations/20261031000000_push_subscription_lang.sql` → `20261031000001_push_subscriptions_rls.sql`. `.env`에 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`(`mailto:` 또는 `https:` 형식) 추가(배포 시 Vercel에도 등록하고 로컬과 다른 키 쌍을 새로 만든다). 로컬에서는 워커를 1분마다 호출해 줄 곳이 없어 별도 터미널에서 `curl` 반복이 필요하고, 운영은 Task 013 배포 후 `pg_cron` 스케줄
  - 제한: iOS는 홈 화면에 설치한 앱에서만 푸시가 되는데 manifest·아이콘은 없음(Task 013). 로그아웃 때 이 브라우저의 구독을 해제하고(`components/app-shell/sign-out-form.tsx`가 `lib/push/client.ts`의 `releasePushSubscription`을 로그아웃 전에 호출, 서버 행 삭제가 실패하거나 3초 넘게 걸려도 브라우저 구독은 해제하고 로그아웃은 계속) 같은 계정으로 다시 로그인하면 자동으로 다시 구독한다. 계정에 "푸시 켜 둠"을 사용자 메타데이터(`push_enabled`)로 저장하고(켤 때 `subscribePush`가 `true`, 설정에서 직접 끌 때 `disablePush`가 `false`, 로그아웃 정리는 그대로 둠), 앱 화면이 열릴 때 켜 둔 계정이고 이 브라우저의 알림 권한이 이미 허용돼 있으면 권한 창 없이 조용히 구독한다(`components/app-shell/push-auto-subscribe*.tsx`). 권한 창은 설정의 스위치를 눌렀을 때만 뜬다. 로그아웃하지 않고 브라우저 데이터만 지우거나 세션이 만료된 경우는 해결하지 못하고 다음 발송 때 `404`·`410`으로 정리된다. 일시 오류 재시도 없음(`failed`로 기록). 테스트 버튼 호출 횟수 제한 없음
- **Task 012: 카카오톡 알림 (F013, F014)** ✅ - 완료(앱 소유자 계정으로 연결·발송·설정 화면 확인)
  - **연결(로그인과 별개)** `app/auth/kakao/connect`·`callback`: Supabase 카카오 로그인을 쓰지 않고 직접 만든 OAuth. 로그인 확인 → 무작위 `state`를 httpOnly 쿠키(10분, `/auth/kakao` 한정)에 저장 → `scope=talk_message`로 카카오 동의 화면 → 돌아와 `state`를 시간이 일정한 비교로 검증하고 코드를 토큰으로 교환. 응답의 동의 항목에 `talk_message`가 있어야 저장하고, 결과는 `/[lang]/settings?kakao=결과`로 알린다(`connected`·`denied`·`failed`·`notConfigured`·`origin`). `proxy.ts` matcher가 `/auth/*`를 제외하므로 라우트가 스스로 로그인을 확인한다. `SITE_URL`과 다른 주소로 시작하면 state 쿠키가 없어 실패하므로 `origin`으로 돌려보낸다
  - **토큰 암호화 저장** `lib/kakao/crypto.ts`: AES-256-GCM, 저장 형식 `iv.tag.암호문`(base64url), 사용자 id를 AAD로 묶어 다른 행으로 옮기면 복호화되지 않는다. 키는 `KAKAO_TOKEN_ENCRYPTION_KEY`(32바이트 base64). 토큰은 평문으로 DB·로그·화면에 두지 않는다
  - **만료 시 갱신** `lib/kakao/tokens.ts`: 만료 5분 전부터 리프레시 토큰으로 갱신해 다시 저장하고(새 리프레시 토큰은 응답에 있을 때만 교체), 같은 사용자의 동시 갱신은 한 번으로 합친다. 리프레시 토큰이 만료·철회(`invalid_grant`)되었거나 복호화가 안 되면 `kakao_tokens.needs_reconnect`를 켠다
  - **발송** `lib/notify/kakao.ts`: "나에게 보내기" 텍스트 템플릿(제목 + 시간 범위, "캘린더 열기" 버튼 → `SITE_URL/[lang]/day/날짜`, 200자 제한). 액세스 토큰이 거부되면 한 번 갱신해 다시 보내고, 끝내 거부되거나 동의 취소 코드(`-3`, `-402`)면 재연결 필요로 표시한다. 문구는 푸시와 같은 `lib/notify/message.ts`. 결과: 성공 `sent`, 연결 안 함 `skipped(not_connected)`, 환경변수 없음 `skipped(kakao_not_configured)`, 재연결 필요 `failed(reconnect_required)`, 일시적 갱신 실패 `failed(kakao_refresh_failed)`, 그 외 `failed(kakao_<원인>)`
  - **설정 화면**: 카카오 카드(연결 안 됨·연결됨·재연결 필요·준비 안 됨, 연결하기·다시 연결하기·테스트 메시지 보내기·연결 해제), 연결 결과 안내(한 번 보여 준 뒤 주소에서 `?kakao=`를 지움), "최근 알림 발송" 목록(대기 중이 아닌 최근 10건, 일정 제목·종류·채널·상태·시각과 사유를 사용자용 문구로 표시). 연결 해제는 카카오 `unlink`(동의 철회·토큰 폐기)를 시도하고 실패해도 우리 쪽 토큰을 지운다
  - **게스트 제한**: 게스트는 카카오톡을 연결할 수 없다. 설정의 연결 버튼이 계정 만들기(`/[lang]/upgrade`)를 안내하는 팝업을 띄우고, `connect`·`callback` 라우트도 게스트를 거부해 `?kakao=guest`로 돌려보낸다(같은 팝업. 연결 버튼의 팝업은 확인함). 데이터를 지우는 로그인 대신 데이터를 유지하는 계정 전환으로 보낸다. 이 제한 전에 연결된 게스트의 기존 연결·발송은 그대로 둔다
  - ⚠️ 적용 필요: `supabase/migrations/20261031000002_kakao_connection.sql`(`kakao_tokens.lang`, `needs_reconnect`). 카카오 개발자 콘솔에서 앱 만들기, 카카오 로그인 활성화, Redirect URI `SITE_URL/auth/kakao/callback` 등록, 동의항목 `talk_message`(선택 동의, 동의 목적 작성) 설정(설정하지 않으면 `KOE205`). `.env`에 `KAKAO_REST_API_KEY`·`KAKAO_CLIENT_SECRET`·`KAKAO_TOKEN_ENCRYPTION_KEY`·`SITE_URL` 추가(배포 시 Vercel에도 등록하고 운영용 Redirect URI·`SITE_URL`·새 암호화 키를 쓴다). 앱 대표 도메인에는 `localhost`를 넣을 수 없다(선택 항목)
  - 제한: 암호화 키를 바꾸면 저장된 토큰을 복호화할 수 없어 모두 재연결해야 한다. 동의 철회 API는 문서에서 확인하지 못해 연결 해제는 `unlink`를 쓴다. 메시지의 링크가 카카오에 등록한 도메인이어야 하는지는 확인하지 못했다(로컬 `localhost` 링크로는 발송됨). 텍스트 글자 수 상한 200자는 알려진 값에 맞춘 것이고 문서로 확인하지 못했다. 다른 사용자(팀원이 아닌 계정)의 동의 가능 여부는 위 "착수 전 결정 사항"에 남아 있다

### Phase 5: 마무리

- **Task 013: 품질 점검 및 배포** - 우선순위
  - `code-reviewer`로 전체 리뷰, 접근성·반응형 점검 (월간 그리드의 ARIA 구조: 일정 칩을 날짜 칸 안으로, 탭 순서 개선 포함)
  - ✅ 잘못된 날짜 경로(`/day/abc`, 존재하지 않는 날짜, 연도 범위 밖)는 `proxy.ts`가 `lib/calendar/day-path.ts`로 걸러 404 상태와 404 화면으로 보낸다(로그인 여부와 무관, 인코딩이 깨진 경로는 Next.js 기본 처리에 맡김). 어디에도 맞지 않는 주소는 `app/[lang]/[...rest]`가 같은 404 화면을 보여 준다. ✅ 사용자용 오류·404 화면(`not-found.tsx`, `error.tsx`, `global-error.tsx`), ✅ 기본 보안 헤더 5종(`next.config.ts`), ✅ `metadataBase`·`openGraph`·manifest·robots·sitemap·앱 아이콘·OG 이미지. 남은 것: 같은 시각에 일정이 매우 많이 겹칠 때 열 수 상한과 "+N" 묶음(주간), 주간 화면이 모든 일정의 `description`을 미리 직렬화하는 부담(상세 대화상자 중복 직렬화는 확인 결과 없음). 월간 화면 낭독(ARIA) 개선은 시각장애 사용자를 현재 고려하지 않아 제외
  - 수동 시나리오: 월 경계·윤년, 월을 넘는 다일 일정, 한 날짜 일정 5개 이상, 비로그인 접근 차단, 타 사용자 데이터 접근 불가(RLS, AI 대화 포함), AI 범위 상한 초과·사용량 제한 도달·만료 대화 비노출, 알림 중복 발송 여부
  - 게스트 수동 시나리오(게스트 시작·AI 4번째 질문 차단·로그아웃 확인·타 계정 데이터 비노출·30일 정리)와 개인정보처리방침의 게스트 보관 문구(30일)
  - ✅ 보안 하드닝(4단계): 마이그레이션 `20261031000003_hardening.sql`(사용자의 notifications 직접 insert 정책 제거, 트리거 함수 `ai_touch_conversation`의 실행 권한 회수, 푸시·카카오 테스트 발송용 빈도 제한 테이블 `action_requests`와 함수 `rate_limit_hit`, `events`의 제목 100자·설명 2000자·색 팔레트 CHECK 제약(`not valid`로 기존 행은 건드리지 않음)과 사용자당 일정 10,000개 상한 트리거), `sendTestPush`·`sendKakaoTest`에 사용자당 1분 3회 제한(`lib/rate-limit.ts`)과 게스트의 카카오 테스트 거부, AI 시스템 프롬프트에 캘린더 외 주제 거절 문구, `docs/ai-security.md` 갱신, `code-reviewer` 보안 리뷰 완료(높은 위험의 RLS·권한·열린 리다이렉트·비밀 노출 문제는 없음). ⚠️ 적용 필요: 이 마이그레이션을 Supabase에서 실행(운영 전에 개발 DB에서 먼저). `docs/ai-security.md`의 남은 항목: AI 테이블 RLS 실검증, 공격 시나리오 시도
  - 보안 리뷰에서 나온 **공개 배포 전 결정·설정**: ① ✅ **CAPTCHA(Cloudflare Turnstile) 코드 구현됨**(계정을 무한히 만들어 AI 질문 3회씩 반복하는 Gemini 비용 남용 방지): 이메일 로그인·가입·게스트 시작·비밀번호 찾기·확인 메일 재발송이 `captchaToken`을 Supabase Auth에 전달하고(`app/[lang]/login/actions.ts`의 `readCaptchaToken`, `captcha_failed`는 안내 문구로), 화면은 `components/auth/captcha.tsx`의 `useCaptcha`가 위젯을 띄운다(`appearance: always`라 위젯이 항상 보이고("확인 중" → "성공", 직접 누르는 확인은 Cloudflare가 의심스럽다고 판단할 때만), 토큰이 올 때까지 제출 버튼이 꺼지며, 토큰은 한 번만 쓸 수 있어 제출이 끝날 때마다 새로 받음). `NEXT_PUBLIC_TURNSTILE_SITE_KEY`가 없으면 위젯도 토큰도 없어 개발 환경은 그대로다. Google 로그인·게스트의 이메일 전환·비밀번호 변경·카카오 연결은 CAPTCHA를 쓰지 않는다. ⚠️ **켜는 순서**: Cloudflare Turnstile 사이트 만들기(도메인에 운영 주소와 `localhost`) → `.env`·Vercel에 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 등록하고 배포 → **그다음** Supabase 대시보드 Authentication > Attack Protection에서 CAPTCHA를 켜고 Turnstile 비밀 키 입력(대시보드를 먼저 켜면 키 없는 앱의 가입·로그인·게스트·비밀번호 찾기가 모두 막힌다). 남은 것: Gemini 일일 비용 상한·경보 설정 ② Supabase Redirect URLs에 운영 도메인만 정확히 등록(와일드카드 금지, 메일 링크 origin은 요청 헤더에서 만들므로 허용 목록이 방어선) ③ Supabase "Secure password change" 켜기(비밀번호 변경에 최근 로그인 요구). **후속(낮음)**: `ai_messages` 직접 삽입으로 assistant 메시지를 위조할 수 있음(AI 답변 저장이 사용자 권한이라, 막으려면 `app/api/ai/route.ts`의 assistant 저장을 service role로 옮기고 삽입 정책을 role='user'로 제한해야 하며 영향은 본인 대화와 한도 안의 비용), 가입 응답이 "이미 가입된 이메일"로 계정 존재를 드러냄, 푸시 구독 10개 상한의 동시 요청 경쟁(DB 트리거로 강제 가능), CSP(배포 후 Report-Only부터)
  - 이메일 인증과 계정 복구(공개 배포 전 필수): **구현됨**: 회원가입 후 세션이 없으면(Confirm email이 켜진 경우) "확인 메일을 보냈어요" 안내, 확인 링크가 `emailRedirectTo`(`/auth/callback?lang=`)로 돌아와 로그인(메일 링크로 로그인되는 것은 확인함. 링크 방식만 지원하고 코드 입력은 없으며, 인가 코드 검증용 정보가 요청한 브라우저에 있어 다른 기기·브라우저에서 열면 마무리되지 않음), 확인 전 로그인은 `email_not_confirmed` 안내와 **확인 메일 다시 보내기**(`resendConfirmation`). **비밀번호 재설정**: 로그인 화면의 "비밀번호를 잊으셨나요?" → `/[lang]/forgot-password`(`requestPasswordReset`, 계정이 있는지 알려 주지 않도록 항상 같은 안내, 요청 과다만 따로 알림) → 메일 링크가 `/auth/callback?recovery=1`로 돌아와 환영 인트로 없이 `/[lang]/reset-password`(`updatePassword`, 새 비밀번호 두 번 입력, 성공하면 **다른 기기의 로그인 모두 해제**)로 이동, 만료·사용한 링크는 `forgot-password?error=expired`. 게스트(이메일 없음)는 재설정 화면에 들어올 수 없다. **비밀번호 규칙**: 8자 이상 + 영문·숫자 포함(`lib/auth/password.ts`, 가입·게스트 계정 전환·재설정이 공용), 가입 화면에 규칙 안내. **남은 것**: Supabase 대시보드의 비밀번호 정책을 같은 값으로 맞추기, Resend 등 **SMTP 직접 연결**(기본 메일 서버는 발송 수 제한이 매우 작음), Supabase Redirect URLs에 운영 `/auth/callback` 등록, 게스트 전환(`upgradeWithEmail`)은 확인 전까지 게스트로 남으므로 대기 중 로그아웃 시 데이터가 즉시 삭제된다는 안내 보강(전환 메일 재발송은 미구현)
  - ✅ 계정 삭제: 설정 화면의 "계정 삭제"(정식 계정만, `components/settings/delete-account-card.tsx`)가 대화상자에서 가입한 이메일을 입력받아(`lib/account/confirm.ts`의 `emailMatches`, 서버도 다시 확인) 브라우저 푸시 구독을 해제한 뒤 `deleteAccount`(`lib/account/actions.ts`)를 부른다. 서버는 로그인·게스트·이메일 일치를 확인하고 카카오 연결 끊기(`lib/kakao/unlink-user.ts`, 실패해도 계속)를 시도한 뒤 `auth.admin.deleteUser`로 계정을 지우며, 일정·AI 대화·푸시 구독·카카오 토큰·알림 기록(7개 테이블)은 `auth.users` FK `on delete cascade`로 함께 지워진다. 로그인 쿠키를 정리하고 로그인 화면으로 이동. 게스트는 기존처럼 로그아웃 시 삭제. 개발 서버가 서버 액션 인자를 터미널에 찍지 않도록 `logging.serverFunctions: false`(비밀번호·푸시 키 노출 방지, 개발 전용)
  - 개인정보처리방침(`/privacy`)에 AI 대화 문구 반영: 일정 제목·설명의 Google Gemini 전송, 대화 30일 보관, 삭제 방법(Google 쪽 데이터 사용·보관 정책(무료 등급은 입력이 모델 개선에 쓰일 수 있음)은 확인 필요)
  - 11분 뒤 일정으로 웹·카카오톡 알림 end-to-end 확인
  - Vercel 프로젝트 생성과 환경변수 등록(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, 이후 추가되는 서버 전용 키)
  - `npm run lint`, `npm run build` 통과 후 Vercel 배포

## 후속 단계 (MVP 제외)

반복 일정, 검색, 주간/일간 뷰, 드래그 편집, 구글 캘린더 가져오기, 공유/초대, AI의 일정 직접 수정, 알림 시점 사용자 설정
