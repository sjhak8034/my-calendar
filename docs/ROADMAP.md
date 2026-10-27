# my-calendar ROADMAP

월간 캘린더, 날짜별 시간 상세, 날짜 범위 AI 대화, 시작·종료 알림(웹 푸시 + 카카오톡)을 만드는 개발 로드맵. 요구사항은 `docs/PRD.md`를 따른다.

**📅 최종 업데이트**: 2026-10-26
**📊 진행 상황**: 8/13 Tasks 완료 (Task 009 AI 대화 2단계 검증 대기, Task 014 게스트 모드 014a 완료·014b 구현, UI 검증 대기)

## 착수 전 결정 사항

- AI 대화 사용량 제한(시간당 20회, 하루 100회)·메시지 200자·대화 30일 보관·쓰기 작업은 확인 버튼 필수: 확정(Task 009)
- 종일 다일 일정의 종료일 포함 여부와 입력 폼의 종료<시작 검증 메시지: Task 008 전 (확정됨: 주 시작 월요일, 6주 고정, 한 칸 3줄, 색 팔레트 8종)
- Vercel Cron / Supabase `pg_cron`·`pg_net` 요금제별 제한 확인: Task 010 전
- 카카오 `talk_message` 동의 항목의 다중 사용자 제공 조건(검수 여부): Task 012 전
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
  - ✅ 월 그리드(6주 × 7일), 요일 헤더, 날짜 배지·월 제목 툴바, 이전/다음/오늘 이동, `?month=YYYY-MM`
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
  - **2단계(구현됨, 검증 대기)**: `create_event` 도구. 모델은 일정을 저장하지 못하고 검증을 통과한 초안만 만든다(`lib/ai/tools.ts`, `toPayload` 재사용, 질문당 최대 3개). 채팅창에 초안 카드(제목·시간·색)가 뜨고 사용자가 "추가" 버튼을 눌러야 기존 `createEvent` Server Action으로 저장(로그인·입력 재검증·`revalidatePath`). 카드는 대화에 저장되지 않아 새로고침하면 사라짐
  - **3단계**: `update_event`·`delete_event` 도구(동일하게 확인 버튼 필수)
  - 보안 방어 현황과 남은 점검(RLS 실검증, 공격 시나리오, 쓰기 도구 도입 시 규칙)은 `docs/ai-security.md`에 정리
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

- **Task 010: 알림 예약 및 발송 워커 (F011, F014)** - 우선순위
  - 일정 저장 시 시작 10분 전·종료 시각 알림 행 생성(종일 일정 제외), 수정·삭제 시 갱신·취소
  - `app/api/cron/notify/route.ts`: 공유 비밀 헤더 검증, 발송 시각이 된 알림 조회 후 발송
  - Supabase `pg_cron` + `pg_net`으로 1분마다 호출
  - 중복 발송 방지(상태 컬럼 + 원자적 갱신)
  - `pg_cron`으로 일 1회 `select public.purge_expired_ai_chats(1000)` 실행(30일 지난 AI 대화 정리, Task 009 보완)
  - `proxy.ts`는 `/api/*`를 로그인 필요 경로로 처리하므로, cron 엔드포인트(`/api/cron/*`)는 비밀 헤더 검증과 함께 proxy에서 예외로 연다
- **Task 011: 웹 푸시 알림 (F012)** - 우선순위
  - `public/sw.js` 서비스 워커, VAPID 키 구성
  - 설정 페이지(`/settings`): 푸시 권한 요청, 구독 등록·해제
  - 서버에서 웹 푸시 발송, 발송 결과 기록
- **Task 012: 카카오톡 알림 (F013, F014)** - 우선순위
  - 카카오 개발자 앱 등록, `talk_message` 동의 항목 설정
  - 설정 페이지에서 카카오 연결·해제(로그인과 별개)
  - 토큰 암호화 저장, 만료 시 갱신 후 발송, 갱신 실패 시 재연결 안내
  - 설정 페이지에 채널별 최근 발송 상태 목록 표시

### Phase 5: 마무리

- **Task 013: 품질 점검 및 배포** - 우선순위
  - `code-reviewer`로 전체 리뷰, 접근성·반응형 점검 (월간 그리드의 ARIA 구조: 일정 칩을 날짜 칸 안으로, 탭 순서 개선 포함)
  - 잘못된 날짜 경로(`/day/abc`)의 HTTP 상태를 404로 만들기(프록시에서 검증), 같은 시각에 일정이 매우 많이 겹칠 때 열 수 상한과 "+N" 묶음, 일정 상세 대화상자 데이터 중복 직렬화 줄이기
  - 수동 시나리오: 월 경계·윤년, 월을 넘는 다일 일정, 한 날짜 일정 5개 이상, 비로그인 접근 차단, 타 사용자 데이터 접근 불가(RLS, AI 대화 포함), AI 범위 상한 초과·사용량 제한 도달·만료 대화 비노출, 알림 중복 발송 여부
  - 게스트 수동 시나리오(게스트 시작·AI 4번째 질문 차단·로그아웃 확인·타 계정 데이터 비노출·30일 정리)와 개인정보처리방침의 게스트 보관 문구(30일)
  - `docs/ai-security.md`의 미완료 점검 항목(AI 테이블 RLS 실검증, 공격 시나리오 시도, `code-reviewer` 보안 리뷰) 처리
  - 이메일 인증과 계정 복구(공개 배포 전 필수): Supabase **Confirm email** 켜기, Resend 등 **SMTP 직접 연결**(기본 메일 서버는 발송 수 제한이 매우 작음), 회원가입 후 "확인 메일을 보냈어요" 안내(현재 `signUp`은 세션이 없으면 일반 오류), 확인 링크용 `emailRedirectTo`와 `/auth/callback` 처리, 확인 메일 재발송, 비밀번호 재설정(현재 없음). 게스트 전환(`upgradeWithEmail`)은 확인 전까지 게스트로 남으므로 대기 중 로그아웃 시 데이터가 즉시 삭제된다는 안내 보강
  - 개인정보처리방침(`/privacy`)에 AI 대화 문구 반영: 일정 제목·설명의 Google Gemini 전송, 대화 30일 보관, 삭제 방법(Google 쪽 데이터 사용·보관 정책(무료 등급은 입력이 모델 개선에 쓰일 수 있음)은 확인 필요)
  - 11분 뒤 일정으로 웹·카카오톡 알림 end-to-end 확인
  - Vercel 프로젝트 생성과 환경변수 등록(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, 이후 추가되는 서버 전용 키)
  - `npm run lint`, `npm run build` 통과 후 Vercel 배포

## 후속 단계 (MVP 제외)

반복 일정, 검색, 주간/일간 뷰, 드래그 편집, 구글 캘린더 가져오기, 공유/초대, AI의 일정 직접 수정, 알림 시점 사용자 설정
