# 📅 my-calendar

> 월간·주간 캘린더에서 일정을 관리하고, **AI에게 말로 일정을 추가·수정·삭제**하며, 시작 전에 **웹 푸시·카카오톡 알림**을 받는 한국어 캘린더 웹앱

- 운영 주소: <https://my-calendar.jhsong.dev>
- 개발 기간: 2026-10-25 ~ (운영 배포 2026-10-29)

---

## 📌 1. 프로젝트 소개

### 주제 선정 배경
일정 앱은 입력이 번거롭고, 알림을 받으려면 앱을 따로 설치해야 합니다. "내일 오후 3시에 치과 잡아줘"처럼 말로 입력하고, 이미 쓰는 **카카오톡·브라우저 푸시**로 알림을 받으면 이 두 가지가 줄어든다고 생각했습니다. 또 단순 기능 구현에서 끝내지 않고 **배포 → 운영 → 비용·보안 관리**까지 직접 경험하는 것을 목표로 했습니다.

### 주요 사항
- **일정 관리:** 월간·주간 화면, 날짜 칸을 끌어 기간 일정 생성, 막대를 끌어 이동·양 끝 늘이기, 장소(카카오맵)·링크, 날짜별 날씨(Open-Meteo)
- **AI 대화:** Gemini 도구 호출로 검색·추가·수정·삭제. **변경은 반드시 확인 카드를 거쳐 실행**
- **알림:** 일정 시작·종료 전 알림 예약(DB 트리거) → 1분 워커가 Web Push·카카오톡 "나에게 보내기"로 발송
- **사용자 인증:** 이메일·Google·**게스트(익명) 로그인**, 비밀번호 재설정, 계정 삭제, CAPTCHA(Turnstile)
- **비용 통제:** 사용자별 질문 횟수 제한 + 관리자가 정하는 **사용자당 하루 사용 금액 한도**(질문 1건 평균 약 1.8원, 모델 `gemini-3.5-flash-lite`, 13건 시험 기준)
- **관리자(`/admin`):** 가입·활동, AI 사용량/비용, 알림 발송, 사용자 목록, 정리 작업 현황
- **다국어:** 한국어·영어

### 핵심 성과·개선 포인트
| 구분 | 내용 |
| --- | --- |
| 안정성 | 알림 워커가 행을 선점(`sending`)해 **중복 발송 방지**, 만료 알림은 `skipped(expired)`로 처리, 일정 수 상한 트리거, 입력 서버 재검증 |
| 보안 | 모든 사용자 데이터 **RLS**로 본인 행만 접근, 카카오 토큰 암호화 저장, 빈도 제한, 보안 헤더 5종 |
| 운영 편의 | 관리자 대시보드로 비용·지연된 알림·정리 작업 상태를 한 화면에서 확인 |
| 비용 | 토큰 사용량 기록(`ai_usage`)과 금액 한도로 AI 지출 상한 관리 |

> 응답 시간 같은 성능 수치는 따로 측정하지 않았습니다. 위 표에는 실제로 확인한 항목만 적었습니다.

### 담당 역할
개인 프로젝트로 기획(PRD)·DB 설계·프론트/백엔드·인프라(Vercel, Supabase, Cloudflare, Resend)·배포·운영 점검을 혼자 맡았습니다. 구현에는 AI 코딩 도구(Claude Code)를 보조로 사용했고, 요구사항 결정과 검증, 계정 권한이 필요한 외부 콘솔 설정은 직접 했습니다.

### 관련 문서
- 요구사항 [`docs/PRD.md`](docs/PRD.md) · 개발 계획 [`docs/ROADMAP.md`](docs/ROADMAP.md)
- 인수인계(현재 상태·결정·함정) [`docs/HANDOFF.md`](docs/HANDOFF.md)
- 검증 기록 [`docs/calendar-verification.md`](docs/calendar-verification.md) · AI 보안 [`docs/ai-security.md`](docs/ai-security.md)

---

## 📌 2. 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui (`@base-ui/react`), lucide-react |
| Backend | Next.js Server Actions · Route Handlers, Supabase (Postgres, Auth, RLS, Vault) |
| AI | Google Gemini API (`gemini-3.5-flash-lite`, 스트리밍 SSE, 도구 호출) |
| 알림 | Web Push (VAPID), 카카오톡 메시지 API, 서비스 워커 |
| 스케줄 | Supabase `pg_cron` + `pg_net` |
| 외부 연동 | 카카오맵 JS SDK, Open-Meteo, Resend(SMTP), Cloudflare Turnstile |
| 배포 | Vercel (GitHub `main` 푸시 시 자동 배포), Cloudflare(도메인·DNS) |

### 선택 이유
- **Next.js:** 서버 컴포넌트·서버 액션으로 별도 API 계층을 줄이고 Vercel과 궁합이 좋습니다.
- **TypeScript strict:** 날짜·기간 계산처럼 틀리기 쉬운 로직을 컴파일 단계에서 잡고, 한국어/영어 사전도 타입으로 키 불일치를 검출합니다.
- **Supabase:** 사용자별 데이터 분리를 **DB 정책(RLS)** 으로 강제할 수 있고, 이메일·Google·익명 로그인을 한 곳에서 지원합니다.
- **Gemini:** 도구 호출과 스트리밍을 지원하고 토큰 단가가 낮아 개인 서비스 비용에 맞습니다.
- **pg_cron:** Vercel Hobby의 Cron은 하루 1회라 1분 단위 알림에 부족해, DB가 워커 URL을 1분마다 호출하도록 했습니다.
- **카카오맵/카카오톡:** 한국 주소·가게 검색 정확도와 한국 사용자의 메신저 사용 습관을 고려했습니다.

---

## 📌 3. 아키텍처

```mermaid
flowchart LR
  U[브라우저] -->|페이지·서버 액션| N[Next.js on Vercel]
  U -->|AI 질문 SSE| A["/api/ai"]
  N -->|RLS, 사용자 JWT| DB[(Supabase Postgres)]
  A -->|도구 호출| G[Gemini API]
  A -->|변경은 확인 카드 후| DB
  CRON[pg_cron 1분] -->|pg_net + Bearer 비밀| W["/api/cron/notify"]
  W -->|service role| DB
  W --> P[Web Push]
  W --> K[카카오톡 API]
  N -.-> M[카카오맵 · Open-Meteo]
  ADM["/admin"] -->|service role, 관리자만| DB
```

**요청 흐름과 접근 제어**
`proxy.ts`가 세션을 갱신하고, `/api/*`는 비로그인이면 401, `/admin`은 관리자만 통과시킵니다(운영에서는 경로 존재를 숨기려 404로 응답). 서버 액션은 매번 `requireUser()`로 로그인을 확인하고 입력을 다시 검증합니다.

**알림 파이프라인**
일정을 저장하면 DB 트리거가 `notifications` 행(시작/종료 × 채널)을 예약합니다. `pg_cron`이 1분마다 워커를 호출하면 워커는 발송 시각이 된 행을 `sending`으로 선점한 뒤 채널별로 보내고 결과를 `sent`/`failed`/`skipped`로 닫습니다. 워커는 `CRON_SECRET`으로 보호되고, 비밀값은 코드가 아니라 Vault에 둡니다.

**AI 대화의 안전장치**
AI는 일정을 직접 바꾸지 못하고 "초안"만 만듭니다. 사용자가 확인 카드에서 승인하면 그때 서버가 사용자 권한으로 실행합니다. 질문 전에 금액 한도와 횟수 한도를 확인하고, 질문 후 토큰 사용량을 기록합니다.

**관리자 영역**
일반 앱과 분리된 두 번째 루트 레이아웃입니다. 접근은 proxy와 페이지·액션에서 이중으로 확인하고, 통계는 DB 함수 없이 서버 코드가 service role로 집계합니다.

**배치**
`notify-due`(1분마다 발송 워커 호출), `purge-daily`(매일 03:00 KST에 만료 AI 대화·게스트·알림 정리). 정의는 [`supabase/cron/schedule.sql`](supabase/cron/schedule.sql).


### 왜 이런 구조로 했나

일정 같은 단순 CRUD는 Supabase에 직접(RLS), 비밀값·외부 연동·여러 단계를 묶는 일은 Next.js 서버 코드에 두었습니다. 근거와 감수한 점은 [📌 4. 의사결정 기록](#-4-의사결정-기록)에 정리했습니다.

---

## 📌 4. 의사결정 기록

기술 선택마다 **상황 → 선택지 → 결정 → 이유 → 감수한 점**을 남깁니다. 새 결정은 아래에 계속 추가합니다.

### 결정 1. 별도 백엔드 없이 Supabase 직접 사용 + Next.js 서버 코드


**상황·결정**: 별도 백엔드 서버(NestJS, Spring 등)를 두지 않고, **일정 같은 단순 CRUD는 Supabase에 직접, 비밀값·외부 연동·여러 단계를 묶는 일은 Next.js 서버 코드에** 두었습니다.

| 하는 일 | 처리 위치 | 이유 |
| --- | --- | --- |
| 일정 조회·저장 | 서버 액션 → Supabase (**사용자 JWT + RLS**) | 본인 데이터만 읽고 쓰는 단순 CRUD라 DB 정책이 권한을 막아 주면 충분함 |
| 입력 검증, 일정 수 상한 | 서버 액션 재검증 + DB 제약·트리거 | 클라이언트 검증은 우회될 수 있어 서버와 DB에서 한 번 더 확인 |
| AI 질문(한도 확인 → Gemini 호출 → 사용량 기록) | `/api/ai` | Gemini 키 같은 비밀값은 브라우저에 둘 수 없고, 여러 단계를 하나로 묶어야 함 |
| 알림 발송, 카카오 토큰 | `/api/cron/notify`, 카카오 라우트 (**service role**) | 푸시 키·토큰 암호화 키를 서버에서만 사용 |
| 관리자 통계·설정 | `/admin` 서버 코드 (**service role**, 관리자 이중 확인) | 모든 사용자 데이터를 집계해야 해서 RLS를 우회하는 권한이 필요 |
| 스케줄 | Supabase `pg_cron` | Vercel Hobby의 Cron은 하루 1회라 1분 단위 알림에 부족 |

**Supabase를 직접 쓴 이유**
- 서버를 만들고 운영하지 않아도 되어, 혼자 만든 규모에서 빠르게 배포하고 Free 플랜으로 운영할 수 있었습니다.
- 데이터 접근 규칙(RLS)이 DB에 있어서, 웹이든 나중에 만들 앱이든 같은 규칙이 적용됩니다.
- 로그인(이메일·Google·익명)을 따로 만들지 않아도 됩니다.

**그 대가로 감수한 것**
- RLS를 잘못 쓰면 곧바로 데이터 노출이므로 정책을 매번 점검해야 합니다. 이 때문에 사용자 쓰기 권한이 없는 테이블(`profiles`, `daily_logins`, `app_settings`)은 service role로만 쓰게 했습니다.
- 여러 단계가 얽힌 규칙은 DB 정책만으로 표현하기 어려워 서버 코드가 필요했습니다. 그래서 "백엔드가 없다"기보다 **Next.js가 가벼운 백엔드 역할**을 합니다.
- Supabase에 의존합니다. DB를 바꾸려면 접근 코드를 다시 써야 합니다.
- DB 트리거·함수는 요청한 경우에만 쓰고, 가입 시 프로필 생성이나 통계 집계 같은 로직은 **DB가 아니라 앱 코드**에 두었습니다(테스트·변경이 쉽고 한 곳에서 읽히기 때문).

**별도 백엔드를 두지 않은 이유와 도입 기준**
- 지금은 사용자·팀 규모가 작아 서버를 하나 더 운영하는 비용이 이득보다 큽니다.
- 아래 상황이 생기면 분리를 검토합니다.
  - 외부에 공개하는 API가 필요할 때
  - 규칙이 복잡해져 서버 코드 한 곳에서 테스트해야 할 때
  - 팀이 커져 서비스를 나눠 맡을 때

### 결정 2. 앱으로 확장할 때 백엔드 분리는 필수인가

**결정**: 필수가 아니라고 판단했습니다. 방식에 따라 다릅니다.
- 필수적으로 백엔드를 분리해야 하는 것은 아닙니다.
  - 웹을 앱처럼 설치하는 **PWA**는 구조 변경이 없습니다.
  - 네이티브 앱(React Native 등)은 일정 조회·저장을 Supabase에 직접 연결하고, `/api/ai`·알림 워커는 그대로 쓰며 푸시 채널(FCM·APNs)만 추가하면 됩니다.
- 걸리는 부분은 **서버 액션**입니다. 웹 화면 전용 호출 방식이라 앱이 부를 수 없으므로, 서버 액션에만 있는 검증 규칙(입력 검증, 일정 수 상한)을 일반 API 경로로 옮기거나 앱에서도 같은 검증을 쓰게 해야 합니다.
- 날짜 계산·입력 검증처럼 순수 TypeScript로 쓴 코드(`lib/calendar`, `lib/events/input.ts`)는 그대로 공유할 수 있습니다.

### 결정 3. 휴일 데이터는 구글 캘린더 공개 캘린더를 쓰고, 서버에서 길게 캐시

**상황**: 월간·주간 화면에 휴일과 휴일명을 표시하고 싶습니다. 한국 휴일은 설날·추석·부처님오신날이 **음력**이고, **대체공휴일·임시공휴일**은 규칙만으로 계산할 수 없어 코드로 직접 만들기 어렵습니다.

| 선택지 | 장점 | 단점 |
| --- | --- | --- |
| 공공데이터포털 특일 정보 API(한국천문연구원) | 공식 데이터, 대체·임시공휴일 반영 | 인증키 발급·관리, 호출 한도 |
| 저장소에 연도별 휴일 JSON 포함 | 외부 의존 없음, 가장 빠름 | 매년 수동 갱신, 임시공휴일 대응이 늦음 |
| 해외 무료 휴일 API(Nager.Date 등) | 키 없이 사용 | 한국 대체·임시공휴일 정확도 미검증 |
| **구글 캘린더 공개 "대한민국의 휴일"(.ics)** | **키 없이 서버에서 읽음**, 공휴일과 기념일이 함께 있음, 영어 캘린더도 제공 | 구글의 형식·정책 변경에 영향, 이름이 구글 표기를 따름 |

**결정**: 구글 캘린더 공개 `.ics`를 서버에서 가져와 쓰고, **서버에서 하루 단위로 캐시**합니다. 화면을 열 때마다 구글에 요청하지 않습니다. 필요한 연도의 휴일만 화면에 쓰고, 월간·주간 둘 다 표시하며, 쉬는 날은 붉게 기념일은 회색 이름만 보여 줍니다.

**이유**
- API 키가 필요 없어 발급·보관·유출 걱정이 없습니다. (공공데이터포털·구글 Calendar API는 둘 다 키가 필요합니다.)
- 대체공휴일까지 반영돼 있습니다. 실제 파일에서 2026년 `쉬는 날 삼일절`(3/2), `쉬는 날 부처님오신날`(5/25), `쉬는 날 개천절`(10/5)을 확인했습니다.
- 서버가 개인정보 없이 공개 파일을 읽으므로 사용자 브라우저가 외부로 나가지 않고, 개인정보 방침의 수집·전송 항목이 늘지 않습니다.

**"필요한 연도만, 연도별 캐시"에서 조정한 점**: 처음에는 연도별로 요청해 캐시하려 했습니다. 그런데 `.ics`는 연도 범위를 지정할 수 없고 **여러 해(2021~2031, 약 280건, 100KB)가 한 파일**로 옵니다. 그래서 파일 전체를 언어별로 한 번만 받아 캐시하고, **화면이 그리는 날짜가 속한 연도만 걸러서** 씁니다. 연도별로 따로 받으면 같은 파일을 연도 수만큼 내려받게 되기 때문입니다. 호출은 캐시가 만료되는 하루 1회 안팎입니다.

**실패했을 때**: 구글이 응답하지 않거나 파일이 비정상이면 오류 종류만 로그에 남기고, 같은 서버 인스턴스에 **직전 성공 값이 있으면 그것을**, 없으면 빈 목록을 **5분만 캐시**해 곧 다시 시도합니다(좋은 캐시를 빈 값으로 덮어쓰지 않으려는 장치). 휴일이 안 보일 뿐 월간·주간 화면은 정상입니다. 서버리스라 인스턴스가 바뀌면 직전 값이 없을 수 있습니다.

**감수한 점**
- 구글이 파일 형식이나 공개 정책을 바꾸면 표시가 멈춥니다(화면은 깨지지 않음). 그 경우 공공데이터포털 API나 정적 JSON으로 바꿀 수 있게 파서(`lib/holidays/ics.ts`)와 조회(`lib/holidays/index.ts`)를 분리해 두었습니다.
- 구글 목록에는 "크리스마스 이브", "섣달 그믐날"처럼 쉬지 않는 날도 있어, `DESCRIPTION`의 분류("공휴일"/"기념일")로 쉬는 날과 기념일을 구분해 표시합니다.
- 데이터는 2021~2031년까지만 있습니다. 그 밖의 해에는 휴일이 표시되지 않습니다.
- 휴대폰의 월간 칸은 폭이 좁아 휴일명을 숨기고 붉은 날짜만 보여 줍니다.

---

## 📌 5. API 명세서

화면 이동은 제외하고 데이터를 읽고 쓰는 진입점만 정리했습니다. "권한"의 `로그인`은 본인 데이터만, `관리자`는 `profiles.role='admin'`, `비밀`은 서버 간 비밀값 인증입니다.

### 4-1. Route Handler

| 기능 | Method | 경로 | 권한 |
| --- | --- | --- | --- |
| AI 질문(SSE 스트리밍) | POST | `/api/ai` | 로그인 |
| 알림 발송 워커 | POST | `/api/cron/notify` | 비밀(`CRON_SECRET`) |
| 로그인 확인·OAuth 콜백 | GET | `/auth/callback` | 공개 |
| 카카오 연결 시작 | GET | `/auth/kakao/connect` | 로그인(게스트 제외) |
| 카카오 연결 콜백 | GET | `/auth/kakao/callback` | 로그인 |

### 4-2. Server Action

| 도메인 | 기능 | 함수 | 권한 |
| --- | --- | --- | --- |
| 일정 | 생성·수정·이동·삭제 | `createEvent` · `updateEvent` · `moveEvent` · `deleteEvent` | 로그인 |
| 날짜 메모 | 저장(내용을 비우면 삭제) | `saveDayNote` | 로그인 |
| AI | 최근 대화 불러오기 / 전체 삭제 / 오늘 사용량 비율 | `loadLatestConversation` · `deleteAllConversations` · `getUsageStatus` | 로그인 |
| 푸시 | 구독 / 해제 / 끄기 / 테스트 | `subscribePush` · `unsubscribePush` · `disablePush` · `sendTestPush` | 로그인 |
| 관리자 | AI 요금 단가 저장 / 사용 금액 한도 저장 | `savePricing` · `saveCostLimit` | 관리자 |

### 4-3. 관리자 화면

| 경로 | 내용 |
| --- | --- |
| `/admin` | 환경 점검, 구현 예정 기능 |
| `/admin/dashboard` | 가입·활동, AI 사용량/비용, 알림 발송, 사용 금액 한도 슬라이더 |
| `/admin/users` | 사용자 목록(필터·정렬·검색) |
| `/admin/cleanup` | 만료 데이터 정리 현황 |

---

## 📌 6. ERD 설계

사용자는 Supabase `auth.users`를 기준으로 하고, 모든 사용자 데이터 테이블은 `user_id`로 연결되어 계정 삭제 시 함께 지워집니다(`on delete cascade`). 일부 보조 테이블(`ai_requests`, `action_requests`, `kakao_tokens`)과 인증 테이블은 생략했습니다.

```mermaid
erDiagram
  AUTH_USERS ||--o| PROFILES : has
  AUTH_USERS ||--o{ EVENTS : owns
  AUTH_USERS ||--o{ DAILY_LOGINS : logs
  AUTH_USERS ||--o{ DAY_NOTES : writes
  AUTH_USERS ||--o{ PUSH_SUBSCRIPTIONS : has
  AUTH_USERS ||--o{ AI_CONVERSATIONS : has
  AUTH_USERS ||--o{ AI_USAGE : "기록(탈퇴 시 null)"
  EVENTS ||--o{ NOTIFICATIONS : schedules
  AI_CONVERSATIONS ||--o{ AI_MESSAGES : contains

  PROFILES {
    uuid user_id PK
    text email
    text role "user | admin"
    text membership
  }
  EVENTS {
    uuid id PK
    uuid user_id FK
    text title
    timestamptz start_at
    timestamptz end_at
    boolean all_day
    text description
    text color
    text location
    text url
  }
  NOTIFICATIONS {
    uuid id PK
    uuid event_id FK
    text kind "start | end"
    text channel "web_push | kakao"
    timestamptz send_at
    text status "pending | sending | sent | failed | skipped"
  }
  PUSH_SUBSCRIPTIONS {
    uuid id PK
    text endpoint UK
    jsonb keys
  }
  AI_CONVERSATIONS {
    uuid id PK
    date start_date
    date end_date
    text title
  }
  AI_MESSAGES {
    uuid id PK
    uuid conversation_id FK
    text role "user | assistant"
    text content
  }
  AI_USAGE {
    uuid id PK
    text model
    int prompt_tokens
    int completion_tokens
    int reasoning_tokens
    boolean is_guest
  }
  DAILY_LOGINS {
    uuid user_id PK
    date day PK
    int count
  }
  DAY_NOTES {
    uuid user_id PK
    date day PK
    text content "1~1000자"
  }
```

그 밖에 관리자 설정 저장용 `app_settings(key, value)`가 있습니다(AI 요금 단가, 사용 금액 한도). 스키마 전체는 [`supabase/migrations/`](supabase/migrations/)의 마이그레이션 17개로 관리합니다.

---

## 📌 7. UI

#### 로그인
<img src="docs/screenshots/login.png" alt="로그인 화면" width="720">

이메일·Google 로그인, 가입 없이 쓰는 **게스트 시작**, Turnstile CAPTCHA.

#### 월간 캘린더
<img src="docs/screenshots/month.png" alt="월간 캘린더" width="720">

여러 날 일정은 사선 무늬 막대로 표시하고, 날짜 옆에 날씨 아이콘이 붙습니다. 칸이 차면 "N개 더 보기"로 펼칩니다.

#### AI 대화
<img src="docs/screenshots/ai-chat.png" alt="AI 대화" width="720">

"내일 3시에 과외일정을 추가해주세요" → AI가 **일정 초안 카드**를 만들고, 사용자가 `추가`를 눌러야 저장됩니다. 맨 위에는 오늘 AI 사용량(한도 대비 %)이 보입니다.

#### 주간 일정
<img src="docs/screenshots/week.png" alt="주간 일정" width="720">

시간 단위 블록을 끌어 이동하고 가장자리를 끌어 길이를 조절합니다. 요일 머리글에 날씨와 기온이 표시됩니다.

#### 일정 수정 (장소·지도)
<img src="docs/screenshots/week-edit.png" alt="일정 수정 사이드바" width="720">

제목·시간·색상·장소·링크·설명. 장소를 입력하면 카카오맵이 표시됩니다.

#### 관리자 대시보드
<img src="docs/screenshots/admin-dashboard.png" alt="관리자 대시보드" width="720">

사용자당 하루 AI 사용 금액 한도(슬라이더)와 가입·로그인·AI·알림 통계.

#### 관리자 사용자 목록
<img src="docs/screenshots/admin-users.png" alt="관리자 사용자 목록" width="720">

이메일은 일부만 가리고(마스킹) 일정은 개수만 보여 줍니다.

---

## 📌 8. 트러블슈팅

### 1) 1분 알림 스케줄러가 실제로는 돌지 않고 있었음
- **증상:** 발송 시각이 지난 알림이 `pending`으로 남음. `curl`로 워커를 직접 부를 때만 발송됨.
- **원인:** DB에 `pg_cron`·`pg_net` 확장과 Vault 비밀값이 없었음(읽기 전용 조회로 발견).
- **해결:** 확장 활성화 후 `schedule.sql` 실행. 처음엔 SQL의 `<배포한 도메인>` 자리표시자를 바꾸지 않아 `invalid URL`로 실패 → `vault.update_secret`으로 수정하고 `cron.job_run_details`와 워커 응답(HTTP 200)으로 확인. 밀려 있던 알림은 `skipped(expired)`로 안전하게 처리됨.
- **교훈:** "설정 완료"를 문서로만 믿지 않고 **조회로 검증**한다.

### 2) AI 토큰 사용량이 실제보다 부풀려 기록됨
- **증상:** 한 질문의 `usage_rounds`가 모델 호출 수보다 큼.
- **원인:** 스트리밍 응답에서 사용량이 **누적값으로 반복**해서 오는데 매번 더했음.
- **해결:** 호출마다 **마지막 값만** 합산, `stream_options.include_usage` 활성화. 질문 시험 세트 13건에서 누락 0 확인.

### 3) Next 16 `cacheComponents`에서 현재 시각을 읽으면 빌드 오류
- **증상:** 설정 페이지에서 `blocking-prerender-current-time`.
- **원인:** 사전 렌더링 중에 현재 시각·세션을 읽는 서버 코드.
- **해결:** `await connection()`을 먼저 호출하고 `<Suspense>` 안에서 실행.

### 4) 끄는 중 포인터를 놓쳐 버튼이 멈춤
- **원인:** 임계값(5px)을 넘은 뒤에야 포인터를 붙잡아, 빠르게 끌면 움직임을 놓침.
- **해결:** 누르는 순간 `setPointerCapture`로 붙잡고, 5px 미만은 클릭으로 처리.

### 5) 모바일 일정 수정 시트에서 저장 버튼이 화면 밖으로 밀림
- **원인:** 저장 줄이 스크롤 내용의 맨 아래에 있었고, AI 버튼이 입력칸을 덮음.
- **해결:** 저장·삭제 줄을 스크롤 영역 밖 고정 푸터로 분리, 수정 창이 열리면 CSS(`body:has(...)`)로 AI 버튼 숨김.

### 6) 깨진 인코딩 경로(`/day/%ZZ`)에서 500
- **원인:** 잘못된 날짜 경로를 `rewrite`로 404 처리하면서 디코딩에 실패한 경로까지 건드림.
- **해결:** 인코딩이 깨진 경로는 건드리지 않고 그대로 통과.

### 7) 개발·운영이 같은 Supabase를 공유
- **영향:** 시험 데이터가 운영과 섞이고, 마이그레이션 전에 새 코드가 배포되면 조회가 실패.
- **대응:** "마이그레이션 먼저 적용 → 푸시" 순서를 문서화하고 운영에 시험 계정을 만들지 않음. 분리는 후속 과제.

---

## 📌 9. 회고

### 배운 점
- 보안은 앱 코드보다 **DB 정책(RLS)과 서버 재검증**에 두는 편이 단순하고 안전합니다.
- AI 비용, 메일 발송 한도, Vercel Cron 제한 같은 **외부 서비스의 한도가 설계를 결정**합니다.
- 확인한 것과 확인하지 못한 것을 구분해 기록(`calendar-verification.md`, `HANDOFF.md`)하니 긴 작업도 이어받기 쉬웠습니다.

### 다시 한다면
- 개발·운영 DB를 처음부터 분리합니다.
- 테스트 러너(단위·E2E)를 초기에 도입합니다. 지금은 `tsc`·`lint`·`build`, 임시 스크립트, 헤드리스 브라우저 확인에 의존합니다.
- 알림 스케줄러처럼 외부 설정이 필요한 항목은 **배포 체크리스트와 상태 점검 화면**을 먼저 만듭니다.
- DB 백업(Free 플랜은 자동 백업 없음), 오류 모니터링, CSP를 초기에 계획합니다.

### 남은 과제
다른 카카오 계정 동의 시험, 개인정보처리방침 전문가 검토, 관리자 기능 확장(오류 모음·공지·문의함 등), 공개 소개/체험 페이지, 앱 확장(PWA 또는 네이티브, 서버 액션 규칙의 API 경로화).

---

## 📌 10. Claude AI 협업 구조

개발에는 Claude Code를 보조 개발자로 썼습니다. **무엇을 시킬지, 무엇을 허용할지, 결과를 어떻게 믿을지**를 문서와 설정으로 고정해 두어 긴 작업에서도 같은 방식으로 일하게 했습니다.

```mermaid
flowchart TB
  H[사용자: 요구사항·결정·승인] --> M[메인 Claude Code 세션]
  CTX["CLAUDE.md · AGENTS.md\n(규칙·스택·Next 16 주의)"] --> M
  MEM["HANDOFF.md · 프로젝트 메모리\n(진행 상태·결정·함정)"] <--> M
  M -->|"계획 → 승인 → 구현"| CODE[코드·마이그레이션·문서]
  M -->|위임, 결과는 데이터로만 취급| SUB["서브에이전트 8종\n(.claude/agents)"]
  M -->|읽기 전용| MCP["Supabase MCP\n(DB 조회·로그)"]
  M -->|임시 스크립트| PW[Playwright 헤드리스\n컴포넌트 실제 입력 시험]
  CODE --> V["tsc · lint · build"]
  V --> H
```

### 1) 컨텍스트 고정: 매 세션이 같은 규칙으로 시작
| 파일 | 역할 |
| --- | --- |
| `CLAUDE.md` | 역할, 기술 스택, 경로 별칭, 코드 규약(한국어 주석 "왜", 사전 키 일치, 아이콘은 lucide만 등) |
| `AGENTS.md` | Next.js 16이 기존 지식과 다르므로 **코드 작성 전에 `node_modules/next/dist/docs/`를 읽도록** 강제(`next dev`가 자동 생성) |
| `docs/HANDOFF.md` | 현재 상태, 사용자가 내린 결정(되묻지 않음), 환경의 함정, 확인한 것/못 한 것 |
| 프로젝트 메모리 | 작업 방식 선호(쉬운 말로 묻기, 커밋·푸시 방식, 트리거는 요청 시에만) |

대화가 길어져 컨텍스트가 요약돼도 `HANDOFF.md`로 이어받을 수 있게 했습니다.

### 2) 서브에이전트 8종 (`.claude/agents/`)
역할별로 **쓸 수 있는 도구를 제한**했습니다. 읽기 전용 에이전트는 파일을 고칠 수 없습니다.

| 에이전트 | 도구 | 용도 |
| --- | --- | --- |
| `prd-generator` / `prd-validator` | 쓰기 / 읽기 전용 | PRD 작성, 완결성·구현 가능성 검증 |
| `development-planner` | 읽기 전용 | 구현 전 요구사항 분석과 단계별 계획 |
| `starter-cleaner` | 읽고 쓰기 | 초기 템플릿 정리 |
| `ui-markup-specialist` | 읽고 쓰기 | 월·주간 그리드, 카드 등 정적 마크업(Tailwind·shadcn) |
| `nextjs-app-developer` | 읽고 쓰기 | App Router 기능 구현·버그 수정 |
| `code-reviewer` | 읽기 전용 | 변경·보안 리뷰 |
| `brand-asset-designer` | 읽고 쓰기 | 로고·아이콘 SVG를 직접 그려 PNG로 내보내기 |

작업 순서는 **계획(planner) → 구현 → 리뷰(reviewer)** 를 기본으로 했습니다.

### 3) 슬래시 커맨드 (`.claude/commands/`)
`git:commit`(gitmoji + 한국어 메시지), `git:branch`, `git:merge`, `git:pr`, `docs:update-roadmap`(로드맵 체크).

### 4) MCP 활용: Supabase (읽기 전용)
- 프로젝트 범위 `.mcp.json`으로 **Supabase MCP를 읽기 전용**으로 연결했습니다. 쓰기는 하지 못하므로 마이그레이션 적용은 사람이 SQL 편집기에서 합니다.
- 쓰임새: 테이블·마이그레이션 적용 여부 확인, 알림 상태 조회, Auth 로그의 오류 코드 확인, 통계 쿼리 결과 모양 확인.
- 실제 사례: 알림이 오지 않는다는 의심에서 `pg_extension`·`cron` 스키마·Vault를 조회해 **스케줄러가 설치되지 않은 것**을 찾아냈고, 설정 후 `cron.job_run_details`와 응답 코드로 **복구를 검증**했습니다(§8).
- `.mcp.json`은 프로젝트 식별자가 들어 있어 **일부러 커밋하지 않았습니다.**

### 5) 브라우저 시험: Playwright 헤드리스
- 이 환경에서는 브라우저 MCP를 쓸 수 없어, `playwright-core`의 헤드리스 Chromium에 **실제 컴포넌트를 개발 서버 CSS와 함께 올려** 마우스 입력(끌기, 길게 누르기 등)을 시험했습니다.
- 로그인이 필요한 실제 화면은 열지 않았고(운영과 DB를 공유하므로 시험 계정을 만들지 않음), 그 부분은 사용자의 화면 확인으로 보완했습니다.

### 6) 안전장치: AI에게 맡기지 않은 것
| 영역 | 규칙 |
| --- | --- |
| 커밋·푸시 | 커밋은 **요청할 때만**, 푸시는 **사용자가 직접**(AI에 GitHub 인증을 주지 않음) |
| 비밀값 | `.env`는 읽거나 쓰지 않고 **줄 수·글자 수만** 확인. 비밀값을 대화에 붙이지 않음 |
| 운영 DB | AI는 **읽기 전용**. 시험 계정·데이터를 임의로 만들지 않음, CAPTCHA를 끄지 않음 |
| DB 설계 | 트리거·함수는 사용자가 요청할 때만 사용 |
| 계정 정보 | 시험 계정 등은 문서·메모리·커밋 어디에도 기록하지 않음 |

### 7) 결과를 믿는 방법
- **서브에이전트의 보고는 데이터로만 취급**하고, 지적 사항은 코드를 직접 열어 사실 확인 후 반영했습니다. 예: 리뷰에서 "AI 메시지의 역할을 제한하자"는 제안이 나왔지만, 어시스턴트 답변 저장을 깨뜨릴 수 있어 보류했습니다.
- **확인한 것과 확인하지 못한 것을 구분해 기록**합니다(`docs/calendar-verification.md`, `HANDOFF.md`). 휴대폰 Safari, 실제 카카오 키 같은 항목은 "미확인"으로 남겼습니다.
- 단계 끝마다 `tsc`·`lint`·`build`를 통과시키고, 큰 작업은 **계획 → 승인 → 단계별 구현·검증·커밋** 순서로 진행했습니다.
- 사용자의 결정은 `HANDOFF.md` §7에 모아 **같은 질문을 되묻지 않게** 했습니다.

### 한계와 배운 점
- AI는 코드를 빠르게 쓰지만 **화면을 직접 보지 못하고**, 외부 콘솔(DB 적용, Vercel, 카카오)과 실제 기기 시험은 사람이 해야 했습니다.
- 환경의 함정(개발·운영 공유 DB, 서버 전용 모듈의 임시 검증 방법 등)을 문서에 남기지 않으면 세션마다 같은 실수를 반복합니다.
- 권한을 좁게(읽기 전용 에이전트, 읽기 전용 MCP, 푸시는 사람) 주는 편이 속도를 거의 해치지 않으면서 사고를 막았습니다.

---

## 🚀 시작하기

```bash
npm install
cp .env.example .env   # 값은 직접 채웁니다(Supabase, Gemini, VAPID, 카카오 등)
npm run dev            # http://localhost:3000
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
```

DB는 `supabase/migrations/`를 순서대로 적용하고, 알림 스케줄은 배포 후 `supabase/cron/schedule.sql`을 한 번 실행합니다.
