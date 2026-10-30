# my-calendar

> 일정을 월간·주간 화면에서 다루고, **AI에게 말로 일정을 추가·수정·삭제**하며, 시작 전에 **웹 푸시·카카오톡으로 알림**을 받는 한국어 캘린더 웹앱.

운영 주소: <https://my-calendar.jhsong.dev>

## 1. 한 줄 소개

일정 관리 앱을 열어도 입력이 귀찮고 알림은 앱을 따로 깔아야 받는 문제를, **"내일 오후 3시에 치과 잡아줘" 같은 대화 입력 + 이미 쓰는 메신저(카카오톡)·브라우저 푸시 알림**으로 줄인 개인용 캘린더입니다. 가입 없이 바로 써 볼 수 있는 게스트 모드도 있습니다.

## 2. 핵심 성과·개선 포인트

| 구분 | 내용 |
| --- | --- |
| 입력 편의 | 월간에서 날짜 칸을 끌어 기간 일정 생성, 막대를 끌어 이동·양 끝 늘이기. 주간은 빈 시간대를 끌어 생성. 휴대폰은 길게 눌러 끌기 |
| AI 대화 | 검색·추가·수정·삭제를 도구 호출로 처리하고, **변경은 반드시 확인 카드를 거쳐** 실행(AI가 임의로 지우지 못함) |
| 비용 통제 | 사용자별 질문 횟수 제한 + 관리자가 정하는 **사용자당 하루 사용 금액 한도**. 실측 질문 1건 평균 약 1.8원(모델 `gemini-3.5-flash-lite`, 13건 시험 기준) |
| 운영 편의 | `/admin`에서 가입·활동·AI 사용량/비용·알림 발송·정리 작업 현황을 한눈에 확인 |
| 안정성 | 알림 워커의 중복 발송 방지(행 선점), 만료 데이터 자동 정리, 입력 서버 재검증, 일정 수 상한 트리거 |
| 보안 | RLS로 사용자 데이터 분리, CAPTCHA(Turnstile), 빈도 제한, 보안 헤더, 토큰 암호화 저장 |

> 성능 수치(응답 시간 등)는 별도로 측정하지 않았습니다. 위 표에는 실제로 확인한 항목만 적었습니다.

## 3. 담당 역할

개인 프로젝트로, 기획(PRD)·DB 설계·프론트/백엔드 구현·인프라(Vercel·Supabase·Cloudflare·Resend)·배포·운영 점검을 혼자 맡았습니다. 구현 과정에서 AI 코딩 도구(Claude Code)를 보조로 썼고, 요구사항 결정·검증·외부 콘솔 설정(계정 권한이 필요한 작업)은 직접 했습니다.

## 4. 기술 선택 이유

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 (App Router, `cacheComponents`) + React 19 | 서버 컴포넌트·서버 액션으로 API 계층을 줄이고, Vercel 배포와 궁합이 좋음 |
| 언어 | TypeScript strict | 날짜·일정 계산처럼 틀리기 쉬운 로직을 컴파일 단계에서 잡기 위해. 한국어/영어 사전도 타입으로 키 불일치 검출 |
| UI | Tailwind v4 + shadcn(`@base-ui/react`) | 디자인 토큰을 CSS 변수로 관리하고 필요한 컴포넌트만 복사해 사용 |
| DB·인증 | Supabase (Postgres + RLS + Auth) | 사용자 단위 데이터 분리를 **DB 정책(RLS)** 으로 강제. 이메일·Google·익명(게스트) 로그인을 한 곳에서 지원 |
| AI | Gemini API | 도구 호출·스트리밍 지원, 토큰 단가가 낮아 개인 서비스 비용에 적합 |
| 알림 | Web Push(VAPID) + 카카오톡 "나에게 보내기" | 앱 설치 없이 브라우저 푸시, 한국 사용자가 가장 많이 확인하는 메신저 |
| 스케줄 | Supabase `pg_cron` + `pg_net` | Vercel Hobby의 Cron은 하루 1회라 1분 단위 알림에 부족 → DB에서 워커 URL을 1분마다 호출 |
| 지도·날씨 | 카카오맵 JS SDK, Open-Meteo | 국내 주소/가게 검색 정확도, 키 없이 쓰는 16일 예보 |
| 배포 | Vercel + Cloudflare(도메인·Turnstile) + Resend(SMTP) | 푸시 한 번으로 자동 배포, 메일 발송 한도 확보 |

## 5. 시스템 구조

```mermaid
flowchart LR
  U[브라우저] -->|페이지·서버 액션| N[Next.js on Vercel]
  U -->|AI 질문 SSE| A[/api/ai]
  N -->|RLS, 사용자 JWT| DB[(Supabase Postgres)]
  A -->|도구 호출| G[Gemini API]
  A -->|일정 변경은 확인 카드 후| DB
  CRON[pg_cron 1분] -->|pg_net + Bearer 비밀| W[/api/cron/notify]
  W -->|service role| DB
  W --> P[Web Push]
  W --> K[카카오톡 API]
  N -.-> M[카카오맵 · Open-Meteo]
  ADM[/admin] -->|service role, 관리자만| DB
```

- **요청 흐름**: `proxy.ts`가 세션을 갱신하고 `/api/*`는 비로그인 401, `/admin`은 관리자만 통과. 서버 액션은 매번 `requireUser()`로 로그인을 확인하고 입력을 다시 검증합니다.
- **DB**: `events`, `notifications`(일정 저장 시 트리거가 알림 예약), `push_subscriptions`, `kakao_tokens`(암호화), `ai_conversations`·`ai_messages`·`ai_usage`·`action_requests`, `profiles`, `daily_logins`, `app_settings` 등 마이그레이션 16개(`supabase/migrations/`). 사용자 데이터는 모두 RLS로 본인 행만 접근합니다.
- **배치**: `notify-due`(1분마다 발송 워커 호출), `purge-daily`(매일 03:00 KST 만료 AI 대화·게스트·알림 정리). 정의는 `supabase/cron/schedule.sql`.
- **외부 연동**: Gemini(AI), Web Push, 카카오(OAuth·메시지·지도), Open-Meteo(날씨), Resend(메일), Cloudflare Turnstile(CAPTCHA).
- **관리자 영역**: 일반 앱과 분리된 두 번째 루트 레이아웃. 접근은 proxy와 페이지·액션에서 이중으로 확인하고, 통계는 DB 함수 없이 서버 코드가 service role로 집계합니다.

## 6. 트러블슈팅

1. **Next 16 `cacheComponents`에서 현재 시각을 읽으면 빌드 오류**
   - 증상: 설정 페이지에서 `blocking-prerender-current-time` 오류.
   - 원인: 사전 렌더링 중에 현재 시각·세션을 읽는 서버 코드가 있었음.
   - 해결: 해당 코드에서 `await connection()`을 먼저 호출하고 `<Suspense>` 안에서 실행.
2. **AI 토큰 사용량이 실제보다 부풀려 기록**
   - 증상: 한 질문의 `usage_rounds`가 호출 수보다 큼.
   - 원인: 스트리밍 응답에서 사용량이 **누적값으로 반복**해서 오는데 매번 더했음.
   - 해결: 모델 호출마다 **마지막 값만** 합산하고, `stream_options.include_usage`를 켬. 이후 질문 시험 세트 13건에서 누락 0 확인.
3. **1분 알림이 실제로는 자동으로 돌지 않고 있었음**
   - 증상: 발송 시각이 지난 알림 다수가 `pending`. `curl`로 워커를 부를 때만 발송됨.
   - 원인: `pg_cron`·`pg_net`이 설치되지 않았고 Vault 비밀값도 없었음. 읽기 전용 조회로 발견.
   - 해결: 확장 활성화 후 `schedule.sql` 실행. 처음엔 SQL의 `<배포한 도메인>` 자리표시자를 바꾸지 않아 `invalid URL`로 실패 → `vault.update_secret`으로 수정, `cron.job_run_details`와 워커 HTTP 200으로 확인. 밀린 12건은 `skipped(expired)`로 안전하게 처리됨.
   - 교훈: "설정 완료"를 문서로만 믿지 않고 **조회로 검증**.
4. **끌기 중 포인터를 놓쳐 AI 버튼이 멈춤**
   - 원인: 임계값(5px)을 넘은 뒤에야 포인터를 붙잡아, 빠르게 끌면 움직임을 놓침.
   - 해결: 누르는 순간 `setPointerCapture`로 붙잡고, 5px 미만은 클릭으로 처리.
5. **모바일 일정 수정 시트에서 저장 버튼이 화면 밖으로 밀림 / AI 버튼이 입력칸을 덮음**
   - 해결: 저장·삭제 줄을 스크롤 영역 밖 고정 푸터로 분리, 수정 창이 열리면 CSS(`body:has(...)`)로 AI 버튼 숨김, 시트 높이를 `58dvh`로 조정.
6. **깨진 인코딩 경로(`/day/%ZZ`)에서 500**
   - 원인: 잘못된 날짜 경로를 `rewrite`로 404 처리하면서 디코딩 실패 경로까지 건드림.
   - 해결: 인코딩이 깨진 경로는 건드리지 않고 그대로 통과.
7. **개발·운영이 같은 Supabase를 공유하는 위험**
   - 영향: 시험 데이터가 운영에 섞이고, 마이그레이션 전에 새 코드가 배포되면 조회가 실패.
   - 대응: "마이그레이션 먼저 적용 → 푸시" 순서를 문서화하고 운영 DB에 시험 계정을 만들지 않음. 분리는 후속 과제.

## 7. 회고

**배운 점**
- 보안은 앱 코드보다 **DB 정책(RLS)과 서버 재검증**에 두는 편이 단순하고 안전하다.
- 외부 서비스(AI 비용, 메일 한도, Vercel Cron 제한 등)의 **한도·요금 제약이 설계를 결정**한다.
- 확인한 것과 확인하지 못한 것을 구분해 기록(`docs/calendar-verification.md`, `docs/HANDOFF.md`)하니 긴 작업도 이어받기 쉬웠다.

**다시 한다면**
- 개발·운영 DB를 처음부터 분리한다.
- 테스트 러너(단위·E2E)를 초기에 도입한다. 지금은 `tsc`·`lint`·`build`, 임시 스크립트, 헤드리스 브라우저 확인에 의존한다.
- 알림 스케줄러처럼 외부 설정이 필요한 항목은 **배포 체크리스트와 상태 점검 화면**을 먼저 만든다.
- DB 백업(Free 플랜은 자동 백업 없음), 오류 모니터링, CSP를 초기에 계획한다.

**남은 과제**: 다른 카카오 계정 동의 시험, 개인정보처리방침 전문가 검토, 관리자 기능(오류 모음·공지·문의함 등), 공개 소개/체험 페이지.

## 시작하기

```bash
npm install
cp .env.example .env   # 값은 직접 채웁니다(Supabase, Gemini, VAPID, 카카오 등)
npm run dev            # http://localhost:3000
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
```

DB 구조는 `supabase/migrations/`를 순서대로 적용하고, 알림 스케줄은 `supabase/cron/schedule.sql`을 배포 후 한 번 실행합니다.

## 문서

- 요구사항: [`docs/PRD.md`](docs/PRD.md) · 개발 계획: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- 인수인계(현재 상태·결정·함정): [`docs/HANDOFF.md`](docs/HANDOFF.md)
- 검증 기록: [`docs/calendar-verification.md`](docs/calendar-verification.md) · AI 보안: [`docs/ai-security.md`](docs/ai-security.md)
