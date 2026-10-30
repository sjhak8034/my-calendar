# 인수인계 (HANDOFF)

최종 갱신: 2026-10-30(월간 편집 §14·날씨 §15·휴대폰 개선 §16 모두 푸시 완료).
상세 근거는 `docs/ROADMAP.md`(작업별 구현 내용), `docs/calendar-verification.md`(검증 원장 14~23절), `docs/ai-security.md`, `docs/PRD.md`에 있다. 이 문서는 그 위에서 "지금 어디까지 왔고 무엇을 조심해야 하며 다음에 무엇을 하는가"만 모았다.

## 1. 한눈에 보기

- 프로젝트: 한국어 중심 캘린더 웹앱(`my-calendar`). Next.js 16.4.3(App Router, `cacheComponents` 켜짐) + React 19 + TypeScript strict + Tailwind v4 + shadcn(base-nova, `@base-ui/react`) + Supabase(Auth/Postgres RLS) + Vercel(운영 배포됨, §13). 원격: `https://github.com/sjhak8034/my-calendar.git`(브랜치 `main`).
- **기능은 모두 구현됨**: 월간·주간 캘린더와 일정 CRUD·드래그, AI 대화(Gemini, 추가·수정·삭제는 확인 카드), 게스트 모드, 알림 예약·발송 워커, 웹 푸시, 카카오톡 알림, 설정 화면, 로그인·가입·비밀번호 재설정, 계정 삭제, CAPTCHA.
- **지금 하는 일은 Task 013(품질 점검 및 배포)의 마무리**. 1~5단계와 CAPTCHA가 끝났고, **6단계(배포)는 운영 주소 `https://my-calendar.jhsong.dev`로 배포를 마친 상태**다(§13). AI 비용 관리(지출 한도, 사용량 기록)와 favicon, 질문 언어 따라 답변까지 끝났다. 남은 것은 다른 카카오 계정 시험, 방침 공개 전 점검 등(§8).
- 로드맵 표기: 11/13 Tasks 완료. Task 009(AI 대화)는 "마무리 점검 대기", Task 014b(게스트→정식 전환)는 "UI 검증 대기".
- 테스트 러너는 없다. 검증은 `npm run lint` · `npx tsc --noEmit` · `npm run build`와 임시 스크립트·`curl`·사용자의 브라우저 확인으로 한다.

## 2. 이어받기 체크리스트

1. `git status -sb`로 상태를 본다. 푸시는 사용자가 별도 터미널에서 `git push origin main` 한다(이 세션에는 GitHub 인증이 없음, §4). 푸시하면 Vercel이 자동 배포한다.
   - `.mcp.json`은 로컬 Supabase MCP 설정(읽기 전용, 프로젝트 범위)이라 **일부러 커밋하지 않았다.** 계속 제외한다.
2. 2026-10-30 기준 작업 트리는 깨끗하고(`.mcp.json` 제외) `origin/main`과 같다. 미커밋 변경이 보이면 이전 세션이 남긴 것이니 `git diff`로 먼저 확인한다. 최근 작업은 §14(월간 편집), §15(날씨), §16(휴대폰 주간).
3. 사용자가 **아직 결과를 알려 주지 않은 확인 항목**(§9)을 물어본다.
4. §8의 남은 작업을 진행한다.

## 3. 읽는 순서

1. `CLAUDE.md`, `AGENTS.md`(Next.js 16 주의: 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 읽는다)
2. 이 문서 → `docs/ROADMAP.md`(특히 Task 009~014) → `docs/calendar-verification.md`(확인함/확인하지 못한 것) → `docs/ai-security.md` → `docs/PRD.md`
3. 계획 원문: `/root/.claude/plans/task-013-bright-elephant.md`(저장소 밖, 같은 기기에서만 보임. 핵심은 §8에 옮겨 두었다)

## 4. 작업 방식과 환경의 함정 (이전 세션에서 배운 것)

### 사용자와 일하는 방식
- 답변은 **한국어**. 사용자가 "질문의 뜻이 불분명했다"고 한 적이 있다(ARIA, 보안 헤더 같은 용어를 풀지 않고 선택지로 물었을 때). **용어는 쉬운 말로 풀고, 선택지는 "그러면 무엇이 어떻게 달라지는지" 중심으로** 묻는다.
- **커밋은 사용자가 요청할 때만** 한다. 지시한 파일만 `git add`하고(`.mcp.json` 제외), 메시지는 gitmoji + 한국어 + 끝에 `Co-Authored-By: Claude <그 세션의 모델> <noreply@anthropic.com>`(2026-10-29까지 `Sonnet 5.5`, `1f3bb24`부터 `Opus 5.5`). 기능과 문서 변경은 따로 커밋하는 편이다.
- **확인하지 못한 것은 "확인하지 못한 것"으로 솔직히 적는다.** 브라우저를 직접 못 보고, DB·메일·카카오·Cloudflare 콘솔은 사용자만 만질 수 있다. 문서(`calendar-verification.md`)에 확인함/확인하지 못한 것을 나눠 적는 관례를 지킨다.
- 큰 작업은 계획(plan mode) → 승인 → 단계별 구현·검증·커밋 순서로 했다. 사용자가 이미 정한 결정은 §7.
- **비밀값을 대화에 붙여 넣게 하지 않는다.** 한 번 개발용 VAPID 키가 대화에 노출된 적이 있어, 운영 전에 새로 만들어야 한다(§8).

### 환경
- 개발 서버(`npm run dev`, `localhost:3000`)는 **사용자가 띄운다.** WSL2에서 돈다. `.env`나 `next.config.ts`를 바꾸면 **재시작**해야 하고, 특히 `NEXT_PUBLIC_*`는 재시작하지 않으면 브라우저 코드에 반영되지 않는다(`ps -eo lstart,cmd | grep next-server`로 시작 시각을 확인).
- 새 라우트 폴더를 만들면 개발 서버가 못 알아볼 때가 있다(404). 파일을 `touch`하거나 재시작한다. `PageProps<"/[lang]/새경로">` 타입 오류가 나면 `npx next typegen`으로 타입을 다시 만든다.
- **`.env`는 자동 모드가 읽기·쓰기를 거부한다.** 값은 읽지 않고 `grep -cE "^이름=" .env`와 `${#v}`로 **줄 수와 글자 수만** 확인하는 패턴을 쓴다. 값 입력과 수정은 사용자가 직접 한다. 사용자가 `.env`에 키를 붙이다 **줄바꿈 없이 이어 붙인 사고**(`SITE_URL=...NEXT_PUBLIC_TURNSTILE_SITE_KEY=...`)가 한 번 있었고 지금은 고쳐져 있다. `.env` 수정을 안내할 때는 "새 줄에 쓰세요"를 강조한다.
- **GitHub 푸시 불가**: 원격이 HTTPS이고 이 세션에 `gh`·자격 증명이 없다. Windows의 Git 자격 증명 관리자를 빌려 쓰려는 시도는 보안 검사가 거부했다(우회하지 않는다).
- **진짜 브라우저 시험이 가능하다(2026-10-29 발견)**: Claude in Chrome은 WSL에서 안 되지만 `playwright-core`로 `chromium-headless-shell`을 받아(`~/.cache/ms-playwright`, 약 120MB) 헤드리스 Chromium을 띄울 수 있다. 로그인이 필요한 실제 앱 화면은 못 열지만(운영과 같은 Supabase라 시험 계정을 만들지 않는다), **실제 컴포넌트(클라이언트 컴포넌트와 순수 JSX인 서버 컴포넌트)를 개발 서버의 CSS와 함께 브라우저에 올려 실제 마우스 입력으로 시험**할 수 있다(§14의 방법). `next/link`와 서버 액션만 esbuild 플러그인으로 모의 구현에 바꿔 번들한다. 실제 앱에서의 동작은 Supabase 로그(요청 종류·상태)로 보조 확인한다. 그 밖의 화면 확인은 여전히 사용자가 스크린샷을 저장해 주거나 직접 본다.
- **(구) 브라우저 도구 없음**: Claude in Chrome은 WSL에서 지원되지 않는다. 화면을 보려면 사용자가 스크린샷을 저장하게 하고(`/mnt/c/Users/thdwj/Downloads` 또는 `Pictures/Screenshots`) `Read`로 이미지를 읽는다.
- **임시 검증 방법**: 서버 전용 모듈(`import "server-only"`)은 일반 Node에서 못 불러서, 그 한 줄을 뺀 사본을 `mktemp -d`에 만들어 `node --input-type=module -e`로 돌리고 지운다(별칭 `@/…` import는 상대 경로로 바꿈). 가짜 `fetch`/`navigator`로 외부 호출과 브라우저 API를 검증한 사례가 `calendar-verification.md`에 많다. 로컬에 Postgres가 없어 **SQL은 실행해 보지 못한다**(적용 후 사용자 확인에 의존).
- **Next.js 16 + cacheComponents 규칙**: 현재 시각·세션(`getUser`)을 읽는 서버 코드는 `await connection()`을 **먼저** 부르고 `<Suspense>` 안에서 실행한다. 빠뜨리면 `blocking-prerender-current-time` 오류가 난다(설정 페이지에서 실제로 겪음). `error.tsx`는 클라이언트 컴포넌트, 루트 레이아웃이 `[lang]`이라 맞지 않는 주소는 `app/[lang]/[...rest]/page.tsx`가 `notFound()`로 받는다.
- `proxy.ts`(루트): `/api/cron/*`은 로그인 검사 없이 통과(라우트가 `CRON_SECRET`을 직접 검증), `/api/*`는 세션 갱신 후 비로그인 401, matcher가 `/auth/*`와 점(`.`)이 있는 경로를 제외(그 라우트는 스스로 로그인 확인), 잘못된 날짜 경로는 `NextResponse.rewrite`로 404. **인코딩이 깨진 경로(`/day/%ZZ`)는 rewrite하면 500이 나므로 건드리지 않는다.**
- 개발 서버는 서버 액션 인자를 터미널에 찍지 않도록 `next.config.ts`에 `logging.serverFunctions: false`를 넣었다(비밀번호·푸시 키 노출 방지).
- Supabase 기본 메일 서버는 **발송 한도가 매우 작다**. 가입·재설정·재발송을 연달아 시험하면 `over_email_send_rate_limit`("요청이 너무 많아요")에 걸린다. 같은 이메일은 약 1분 간격.
- 코드 규약: 주석은 한국어로 "왜"를 적는다. 문구는 `lib/i18n/dictionaries/ko.json`·`en.json`에 **같은 키로** 둔다(`Dictionary` 타입이 ko 기준이라 en이 어긋나면 `tsc`가 잡는다). 아이콘은 `lucide-react`만, UI는 `components/ui`에 있는 shadcn만(`AlertDialog`는 없어서 `Dialog` 사용). 서버 액션은 매번 `requireUser()`로 로그인을 확인하고 입력을 다시 검증한다. 로그에는 오류 코드·상태만 남기고 이메일·토큰·endpoint·비밀번호는 남기지 않는다. `cn`은 `clsx`+`tailwind-merge`가 아니라 충돌을 병합하지 않으므로 `!`로 덮어쓴다.

## 5. 구현 현황과 주요 파일

| Task | 내용 | 상태 |
| --- | --- | --- |
| 001~008 | 초기 설정, Supabase 스키마·RLS, 인증(이메일+Google), 날짜 유틸, 월간·주간 화면, 일정 CRUD·드래그 | 완료 |
| 009 | AI 대화(우하단 팝업, Gemini, 검색·추가·수정·삭제 도구, 사용량 제한) | 구현됨, **마무리 점검 대기** |
| 010 | 알림 예약(DB 트리거)·발송 워커 `/api/cron/notify` | 완료 |
| 011 | 웹 푸시(설정, 서비스 워커, 로그아웃 시 해제·재로그인 시 자동 복원) | 완료 |
| 012 | 카카오톡 "나에게 보내기"(자체 OAuth, 토큰 암호화, 설정 화면, 발송 기록) | 완료 |
| 014 | 게스트 모드(익명 로그인). 014a 완료, **014b(정식 계정 전환) UI 검증 대기** | 부분 |
| 013 | 품질 점검 및 배포 | **진행 중**(§6) |

디렉터리 지도(역할만):
- `app/[lang]/` — 로케일 라우트. `(app)/`(사이드바 레이아웃: 월간 `page.tsx`, `day/[date]`, `settings`, `upgrade`), `login`, `forgot-password`, `reset-password`, `privacy`, `welcome`, `[...rest]`(404), `not-found.tsx`, `error.tsx`. `app/global-error.tsx`, `app/manifest.ts`·`robots.ts`·`sitemap.ts`, `app/api/ai`·`api/cron/notify`, `app/auth/callback`·`auth/kakao/connect|callback`.
- `lib/` — `calendar/`(순수 날짜·배치·드래그 계산), `events/`(입력 검증·조회·액션), `ai/`(Gemini·도구·프롬프트), `notify/`(발송: `dispatch.ts`→`web-push.ts`·`kakao.ts`, 문구 `message.ts`, 기록 `history.ts`), `push/`(구독 검증·액션·브라우저 도우미 `client.ts`), `kakao/`(OAuth·토큰·암호화·클라이언트), `account/`(계정 삭제), `auth/password.ts`(비밀번호 규칙), `supabase/`(server/client/admin/proxy/require-user/current-user), `i18n/`, `rate-limit.ts`, `site.ts`.
- `components/` — `calendar/`, `app-shell/`(사이드바, 로그아웃 폼, 푸시 자동 복원), `settings/`(푸시·카카오·삭제 카드, 발송 기록), `auth/`(로그인·비밀번호 폼, `captcha.tsx`), `ai/`, `ui/`(shadcn).
- `supabase/migrations/`(16개, 마지막 `20261102000004_daily_logins.sql`. 모두 적용 확인함), `supabase/cron/schedule.sql`(배포 후 수동 실행), `public/sw.js`(서비스 워커), `public/icon-*.png`.

## 6. Task 013 단계별 현황

| 단계 | 내용 | 상태 | 커밋 |
| --- | --- | --- | --- |
| 1 | 잘못된 날짜 404 상태, 오류·404 화면, 보안 헤더 5종, metadata·manifest·robots·sitemap·아이콘·OG 이미지 | 완료 | `890109a` |
| 2 | 비밀번호 재설정, 확인 메일 재발송, 비밀번호 규칙(8자 이상 + 영문·숫자) | 완료 | `44e9a82` |
| 3 | 계정 삭제(비밀번호 확인+CAPTCHA, Google 전용 계정은 이메일 입력, 카카오 연결 끊기, 푸시 해제, 7개 테이블 cascade) | 완료 | `169d70b` |
| 4 | 보안 하드닝(빈도 제한, `events` 제약·개수 상한, 정책·권한 정리, AI 주제 제한), 보안 리뷰 | 완료 | `74f919d` |
| + | Turnstile CAPTCHA(가입·로그인·게스트·비밀번호 찾기·재발송) | 완료(코드) | `e510f9e` |
| + | 위젯 항상 표시 | 완료 | `902f628` |
| 5 | 개인정보처리방침 본문(ko/en 초안, 연락처 `lib/site.ts`의 `PRIVACY_CONTACT_EMAIL`). 공개 전 확인: Supabase 서버 지역 문구, Gemini 데이터 사용 문구, 만 14세 미만 문구, 법률 검토 | 완료(초안) | `4e46ec8` |
| 6 | 배포(Vercel, 환경변수, 콘솔 설정, `schedule.sql`) | **완료**(§13). 남은 후속은 §8 | `a91674b` 외 |
| + | 계정 삭제 확인을 비밀번호 입력으로 변경(Google 전용 계정은 이메일 입력) | 완료 | `53b55ba` |
| + | 로그인 확인 왕복 줄이기(`proxy`의 `getClaims`, `requireUser` 중복 제거) | 완료 | `3eda7a2` |
| + | 문의 연락처 `privacy@jhsong.dev` | 완료 | `55041d0` |
| + | AI 질문별 토큰 사용량 기록: 서버 로그 `[ai] usage`(`86bd6be`)와 DB `ai_usage`(`8730f82`), 호출마다 마지막 사용량만 합산하도록 수정(`d4cdb62`) | 완료 | `86bd6be`·`8730f82`·`d4cdb62` |
| + | 개인정보처리방침: Gemini 유료 등급 문구, AI 사용 기록(토큰 수, 90일) | 완료 | `74d9d14`·`a46e1a7` |
| + | favicon을 새 로고(`icon-512`)로 교체 | 완료 | `8d9dcc7` |
| + | AI가 질문한 언어로 답변(화면 언어 고정 해제) | 완료 | `25796fe` |
| + | 월간 그리드 편집: 날짜 칸을 끌어 기간 일정 만들기, 종일·여러 날 일정 사선 무늬, 막대 클릭 수정, 막대 끌어 이동·양 끝 늘이기(§14) | 완료(푸시됨) | `6795444`·`214cba0`·`8ed9f2b`·`1f3bb24` 외 |
| + | 날짜별 날씨·기온 표시(월간 아이콘, 주간 아이콘+기온, 브라우저 위치, Open-Meteo, §15) | 구현됨(푸시됨, 실제 화면 확인 대기) | `9a21635` |
| 선택 | 주간 겹침 열 수 상한과 "+N" 묶음 | 미룸 | - |

## 7. 사용자가 내린 결정 (되묻지 않는다)

- 계정 삭제: 이번에 구현함. 월간 달력 **화면 낭독(ARIA) 개선은 제외**(시각장애 사용자는 현재 고려하지 않음). 보안 헤더는 **기본 5종만**(CSP는 후속). 배포는 **대화로 함께**(계정 권한이 필요한 클릭은 사용자가 직접). 비밀번호 규칙은 **8자 이상 + 영문·숫자**. **CAPTCHA를 추가**(Turnstile, 항상 표시).
- 게스트는 카카오톡을 연결할 수 없고 "계정 만들기"(`/upgrade`) 안내 팝업을 본다(로그인 대신 계정 전환으로 보내는 이유: 게스트가 로그아웃하면 데이터가 즉시 삭제됨).
- 푸시는 로그아웃 때 이 브라우저 구독을 해제하고, 같은 계정으로 다시 로그인하면(알림 권한이 이미 허용된 브라우저에서) **자동으로 다시 구독**한다(`user_metadata.push_enabled`). 설정에서 직접 끄면 복원되지 않는다.
- 개인정보처리방침은 법률 자문이 아닌 **초안**으로 쓰고 화면에 그렇게 명시한다.
- **날씨 표시(2026-10-30)**: 지역은 **브라우저 위치**(못 받으면 서울), 범위는 **오늘부터 약 2주 예보만**, 월간은 아이콘만(기온은 툴팁), 주간은 요일 앞 아이콘 + 머리글 한 줄 아래 작은 기온. 제3자 서비스는 Open-Meteo(결정 근거: 키 불필요·CORS 허용·16일 예보).
- **관리자 영역 결정(2026-11-02)**: 역할(`role`)과 멤버십 등급(`membership`)을 **별개 컬럼·enum**으로, 경로는 `/admin` **별도 루트 레이아웃**, 관리자 확인은 proxy + 페이지·액션 이중, 접속 횟수는 **로그인 횟수**(`daily_logins`)로 대신, AI 단가는 **관리자 화면에서 입력해 DB에 저장**(코드에 값 없음), 통계는 DB 함수 없이 서버 코드로 집계(§18).
- **DB 트리거는 사용자가 요청할 때만 만든다**(2026-11-02 결정). 가입 때 `profiles` 행 만들기 같은 자동 동작은 앱 서버 코드로 구현한다(`lib/profile/ensure-profile.ts`). 기존 트리거(알림 예약, 일정 수 상한, `set_updated_at` 등)는 그대로 둔다.
- **DB 백업은 지금 설정하지 않는다**(2026-10-29 결정, 추후 개선사항). Supabase **Free 플랜에는 자동 백업이 없다**(Pro는 월 $25부터, 매일 백업 7일 보관, PITR은 월 $100 추가). 사용자 데이터를 본격적으로 받기 전에 다시 결정한다(§8의 "운영 개선").

## 8. 남은 작업 (우선순위 순)

배포와 알림·메일·카카오 연결은 끝났다. 남은 것:

1. **AI 비용 관리(대부분 완료)**: Gemini **유료 등급**, **지출 한도 설정됨**(Google 콘솔에 있는 기능), 운영 모델은 **`gemini-3.5-flash-lite`**(환경변수 `GEMINI_MODEL`, 코드 기본값은 `lib/ai/limits.ts`의 `gemini-3.8-flash`이므로 환경변수가 없으면 2027-01-01 가격 인상 대상 모델이 된다). 실측(13건, 2026-10-29): 질문 1건 평균 입력 약 3,650·출력 약 80 토큰, 모델 호출 평균 2.08번, 약 1.8원(1,000건 약 1,800원). 입력이 98%이고 시스템 프롬프트+도구 설명이 호출마다 약 1,600 토큰이다. 모델 가격(2026-10-28, 100만 토큰당): 3.8 Flash $0.75/$3.75(2027-01-01에 $1.50/$7.50), 3.5 Flash-Lite $0.30/$2.50, 3.1 Flash-Lite $0.25/$1.50, Claude Haiku 5.5 $0.10/$0.50.
   - **Claude Haiku 5.5 전환은 보류**(결정): 질문 1,000건에 약 1,200원 절감이라 지금은 이득이 작다. 하려면 `gemini.ts`·`sse.ts`·`prompt.ts`·`tools.ts`(정의 모양만)·`route.ts` 다섯 곳을 Messages API 형식으로 바꿔야 하고(스트리밍 이벤트, `tool_use`/`tool_result` 블록, `system` 분리), 방침의 처리 위탁 업체(Google→Anthropic)와 데이터 정책 확인이 필요하다. 채팅 화면·DB·도구 실행 로직은 그대로.
   - **키 제한**: IP 제한은 걸지 않는다(Vercel 서버 IP가 일정하지 않아 AI가 멈춘다). "API 제한사항"에서 Gemini API만 허용하는 설정은 콘솔에서 이름이 `Gemini API`로 보이는 것까지만 확인했고 적용 여부는 미확인. 키는 서버 환경변수에만 있다.
   - **개인정보처리방침의 Gemini 문구는 "유료 서비스로 이용하며 제품 개선에 사용되지 않는다"에 근거한다.** 무료 등급으로 바꾸면 문구를 되돌려야 한다. Gemini API 약관 원문 확인은 아직 하지 못했다.
   - 사용량 조회: `select date_trunc('day', created_at) as day, model, count(*) as questions, sum(prompt_tokens) as prompt, sum(completion_tokens) as completion from public.ai_usage group by 1,2 order by 1 desc;`. 부풀려진 첫 행(2026-10-29 09:13 UTC, `usage_rounds`>`rounds`)은 버그 수정 전 기록이라 집계에서 빼거나 지운다.
2. (완료) favicon은 교체했다(`8d9dcc7`). 구글 검색 결과 아이콘 반영은 며칠 걸린다.
3. **다른 카카오 계정으로 연결 시험**: `talk_message` 동의가 앱 소유자 외 계정에도 되는지 미확인. 심사가 필요하면 카카오 연결은 소유자 전용으로 둔다.
4. **개인정보처리방침 공개 전 점검**: Supabase 서버 지역은 사용자가 "아시아(도쿄 또는 싱가포르)"라고 답해 방침에 "국외(아시아 지역)"로만 적었다(정확한 지역을 알게 되면 구체화), 만 14세 미만은 가입할 수 없다는 문구를 넣었다(나이 확인 기능은 없음), 남은 것은 Gemini API 약관 원문 확인과 전문가 검토.
5. **Supabase Auth 한도 조정 관찰**: 가입·로그인·게스트 한도는 IP당이지만 요청이 Vercel 서버 IP에서 나가므로 사실상 전체 이용자가 공유할 수 있다(추정). 게스트 100/시간, 인증 관련 60으로 올려 둠. 이용자가 늘면 Auth 로그의 `over_request_rate_limit`을 본다.
6. **운영 개선(추후, 사용자 결정으로 보류)**: ① **DB 백업**: 선택지는 A) Pro 플랜(자동 백업 7일), B) 직접 백업(`pg_dump`/`supabase db dump`을 정기 실행, 접속 주소에 비밀번호가 있어 대화·저장소에 붙이지 않고, 복원 시험까지 해야 함), C) 하지 않음(현재). 구조(테이블·정책)는 `supabase/migrations/`로 복구되지만 **사용자 데이터(일정·계정)는 복구할 수 없다.** Free 프로젝트는 1주일 활동이 없으면 일시정지되나, 1분 워커 호출이 DB를 읽어 막아 줄 가능성이 크다(미확인, 정지 알림 메일 주의). ② **개발·운영 DB 분리**(지금은 같은 Supabase, Free 플랜은 프로젝트 2개까지로 알고 있으나 미확인). ③ 오류·장애 모니터링과 업타임 알림. ④ 운영용 Gemini 키 분리.
7. **선택·후속(낮은 위험)**: 익명 역할의 테이블 권한 회수 마이그레이션 제안(`events`·`notifications`·`push_subscriptions`·`kakao_tokens`는 익명 키로 조회하면 RLS 때문에 `[]`, `ai_*`·`action_requests`는 `42501`), `ai_messages`에 assistant 메시지를 직접 넣어 위조 가능(막으려면 `app/api/ai/route.ts`의 assistant 저장을 service role로 옮기고 삽입 정책을 role='user'로 제한), 가입 응답의 계정 존재 노출, 푸시 구독 10개 상한 경쟁, CSP(Report-Only부터), 주간 겹침 열 수 상한·"+N", 주간 `description` 지연 로드, 카카오 암호화 키 회전 절차, 메일 코드(OTP) 입력, `events`에 `start_at`·`end_at` 인덱스가 있는지 점검(월·주간 조회 조건), 개발과 운영이 같은 Supabase를 쓰는 위험 정리(분리 여부 재검토).

## 9. 사용자 확인 대기 중인 시험 (결과를 아직 못 들음)

- `20261031000003_hardening.sql` 적용 후 **일정 추가·수정이 정상인지**(새 제약·10,000개 상한 트리거). 익명 키 조회로 `action_requests`가 존재함(→ 적용된 듯)까지만 확인됨.
- 설정 화면에서 푸시·카카오 **테스트 버튼을 연달아 눌러 4번째에 제한 안내**가 나오는지.
- 비밀번호 재설정 end-to-end(메일 한도에 걸려 못 끝냄), 확인 메일 다시 보내기, 약한·불일치·같은 비밀번호 거부 문구.
- **CAPTCHA**: 사이트 키는 **실제 키**(`0x4…`)이고 Supabase 서버 검증이 켜져 있다(토큰 없는 요청이 `captcha_failed`로 거절됨을 확인). 로그인·게스트는 운영에서 확인했고, **가입·비밀번호 찾기·확인 메일 재발송의 끝까지 시험은 미확인**. 위젯은 대부분 사람에게 클릭 없이 자동 통과한다(정상).
- 계정 삭제(**시험용 계정으로만**; 되돌릴 수 없음), 푸시의 로그아웃 해제·재로그인 자동 복원, 카카오 연결 해제·재연결·토큰 만료 후 갱신·재연결 필요 상태, 게스트가 주소로 `/auth/kakao/connect`를 직접 열었을 때의 팝업, 영어 화면 전체.
- 구글로 가입한 계정이 "비밀번호 찾기"로 비밀번호를 설정할 수 있는지, 같은 이메일 가입 시 계정 연결 동작.
- **운영에서의 계정 삭제**(시험용 계정으로만, 비밀번호+CAPTCHA 확인), 방침 문구 변경 뒤 푸시 테스트 알림(`VAPID_SUBJECT` 변경 반영 확인), 비밀번호 재설정 end-to-end(메일 발송은 성공함).
- **월간 그리드 편집의 세부 항목**(끌기·막대 클릭 수정은 사용자가 확인함): 다크 모드와 8가지 색에서의 사선 무늬·미리 보기 막대, 작은 화면(아래 시트), 키보드로 막대를 열고 닫을 때 포커스, Ctrl/⌘ 클릭·가운데 버튼의 새 탭 열기, 저장 실패 알림(§14).
- 처음 워커를 호출했을 때 사용자가 "0byte 파일도 왔다"고 한 일은 재현되지 않았고 원인 불명.

## 10. 환경변수 (이름과 상태. 값은 어디에도 적지 않는다)

`.env`는 gitignore. 마지막 확인(2026-10-29): 아래 14개가 모두 설정되어 있다(글자 수만 확인함). 설명 원본은 `.env.example`. **로컬 `.env`와 Vercel(운영) 값은 다르다**: 운영은 VAPID 키 쌍, `CRON_SECRET`, `KAKAO_TOKEN_ENCRYPTION_KEY`를 새로 만들었고 `SITE_URL=https://my-calendar.jhsong.dev`, `VAPID_SUBJECT=mailto:privacy@jhsong.dev`다. 같은 Supabase를 공유하므로 **카카오 연결·시험은 당분간 운영 주소에서만** 한다(키가 다르면 복호화에 실패해 "재연결 필요"로 표시됨).

| 이름 | 구분 | 용도·메모 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 | Supabase 연결 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 | RLS 우회. 워커·푸시 저장·계정 삭제·카카오 토큰에만 사용 |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 서버 | AI 대화 |
| `CRON_SECRET` | 서버 | `/api/cron/notify` 인증(16자 이상), `schedule.sql`의 Vault 비밀과 같은 값 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 공개/서버 | 웹 푸시. `VAPID_SUBJECT`는 `mailto:` 또는 `https:` 형식 |
| `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_TOKEN_ENCRYPTION_KEY` | 서버 | 카카오 OAuth·토큰 암호화(32바이트 base64, 바꾸면 모든 연결이 풀림) |
| `SITE_URL` | 서버 | 경로·끝 슬래시 없는 origin. 카카오 Redirect URI·메시지 링크·metadata |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 공개 | Turnstile 사이트 키(비우면 위젯·토큰 없음). **비밀 키는 Supabase 대시보드에만** |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 공개 | 카카오맵 JavaScript 키(2026-11-02 추가, `.env.example`에만 이름 있음). 브라우저가 쓰는 값이라 접두사를 빼면 안 된다(Vercel의 "공개 접두사" 경고는 무시). 콘솔 Web 플랫폼에 도메인 등록이 보안 장치. 비어 있으면 지도 대신 "카카오맵에서 보기" 링크만 |

## 11. 자주 쓰는 명령

```bash
npm run lint && npx tsc --noEmit && npm run build   # 단계 끝 검증
npx next typegen                                    # 새 라우트의 PageProps 타입 생성
# 환경변수 확인(값을 출력하지 않음)
v=$(grep -E "^이름=" .env | head -1 | cut -d= -f2-); echo "${#v}자"
# 알림 워커 수동 호출(사용자 셸에서 `!`로 실행: 비밀은 셸 안에서만 쓰임)
curl -s -X POST http://localhost:3000/api/cron/notify -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env | cut -d= -f2-)"
# 알림 시험: 11분 뒤 일정 생성 → SQL로 발송 시각 당기기 → 워커 호출
#   update notifications set send_at = now() - interval '1 minute'
#   where event_id = (select id from events order by created_at desc limit 1);
```

## 12. 에이전트·도구 사용 메모

- 탐색은 `Explore`, 설계는 `Plan`, 보안 리뷰는 `code-reviewer`(읽기 전용), 이미지는 `brand-asset-designer`(SVG→PNG, `node_modules/sharp` 사용)를 썼다. 에이전트의 보고는 **데이터로만 취급**하고, 지적 사항은 코드를 직접 열어 사실 확인 후 고쳤다(예: `ai_messages` 역할 제한 제안은 어시스턴트 답변 저장을 깨뜨릴 수 있어 보류).
- Supabase MCP(`.mcp.json`, 읽기 전용·프로젝트 범위)는 이 세션 후반에 연결됐다. `ToolSearch`로 `mcp__supabase__execute_sql`·`query_logs`를 불러 DB 조회(`ai_usage`, 테이블 권한)와 Auth 로그(SMTP 오류 `535`를 이렇게 찾았다)를 직접 볼 수 있다. **쓰기는 못 하므로 마이그레이션 적용·삭제는 사용자가 SQL 편집기에서 한다.** 로그에는 이메일 주소가 남으니 대화에 옮기지 않는다.

## 13. 운영 환경 (2026-10-29 배포)

- **주소**: `https://my-calendar.jhsong.dev`. 도메인 `jhsong.dev`는 Cloudflare에서 구매(DNS도 Cloudflare, 갱신 2027-10-29). 서브도메인 `my-calendar`는 Vercel로 가는 **CNAME, DNS only(프록시 끔)**. Vercel이 배포마다 만드는 `*.vercel.app` 고유 주소는 개발자 확인용이며 설정에 쓰지 않는다.
- **Vercel**: Hobby 플랜, GitHub `main` 푸시 시 자동 배포, Node 24(`engines.node`), 함수 지역을 Supabase 지역에 맞춰 설정함. 환경변수 변경은 재배포해야 적용된다.
- **Supabase**: 개발과 같은 프로젝트를 운영에도 쓴다(결정). Site URL·Redirect URLs는 운영 주소. CAPTCHA(Turnstile) 켜짐(토큰 없는 요청이 `captcha_failed`로 거절됨을 확인). **Custom SMTP는 Resend**(발송 서브도메인 `send.jhsong.dev`, Sender `no-reply@jhsong.dev`, Username `resend`, 비밀번호는 API 키). 메일 발송 한도 30/시간, 같은 사용자 60초 간격, 게스트 100/시간, 인증 관련 60.
- **알림 스케줄**: `pg_cron`이 1분마다 `/api/cron/notify`를 호출(`supabase/cron/schedule.sql`, 비밀은 Vault 화면에서 입력). 알림은 최대 약 1분 늦게 발송되는 것이 정상.
- **Cloudflare**: Turnstile 사이트 허용 도메인에 `my-calendar.jhsong.dev`(와 `localhost`), Email Routing으로 `privacy@jhsong.dev` → 개인 Gmail 전달(Catch-all·Subaddressing은 끔). 루트 도메인 SPF는 Cloudflare 한 줄, Resend는 `send` 서브도메인.
- **카카오 콘솔**: 로그인 Redirect URI에 `https://my-calendar.jhsong.dev/auth/kakao/callback`(**로그아웃 Redirect URI와 다른 항목**), 웹 사이트 도메인 등록. 본인 계정으로 연결·테스트 메시지 확인함.
- **확인한 것**(외부 `curl`): 보안 헤더 5종, 잘못된 날짜 404, 비로그인 `/api/ai` 401, 인증 없는 워커 호출 401, `sw.js` 헤더, `robots`·`sitemap`이 운영 주소, 새 연락처 표시.
- **하지 못한 것**: 로그인한 상태의 화면 속도 측정, 다른 카카오 계정 동의, 비밀번호 재설정 end-to-end(메일은 성공), 운영에서의 계정 삭제 시험.
- **롤백**: Vercel Instant Rollback(DB는 되돌리지 않음).
- **날씨(2026-10-30, 푸시됨)**: 브라우저가 `api.open-meteo.com`을 직접 호출한다(CSP가 없어 막히지 않음). 보안 헤더 `Permissions-Policy`가 `geolocation=(self)`로 바뀌어 **배포 뒤 헤더 확인**(`curl -I`)이 필요하다. 환경변수·DB 변경 없음. 방침 시행일이 2026-10-30으로 바뀜. Open-Meteo 무료는 비상업·출처 표기 조건(§15).
- **AI**: Gemini 유료, 지출 한도 설정, 모델 `gemini-3.5-flash-lite`. 질문별 토큰은 Vercel Logs의 `[ai] usage` 줄과 `ai_usage` 표(서버만 쓰기, 90일 보관, 계정 삭제 시 `user_id`는 null)에 남는다. 스트리밍 요청에 `stream_options.include_usage`가 있어야 사용량이 오고, 사용량은 한 스트림 안에서 누적값이 반복되므로 호출마다 **마지막 값만** 쓴다. 답변 언어는 질문 언어를 따르고 불분명하면 화면 언어. 질문 시험 세트(검색·추가·모호한 날짜·수정·삭제·영어·주제 이탈·프롬프트 주입)로 13건을 돌려 `missing_usage=0` 확인.
- **배포 순서 주의**: DB 마이그레이션이 필요한 코드는 **마이그레이션을 먼저 적용한 뒤 푸시**한다(예: `ai_usage`).

## 14. 최근 작업: 월간 그리드 편집(2026-10-29, 커밋·푸시 완료)

**커밋(모두 푸시됨, 2026-10-30에 `origin/main`과 같음을 확인)**: 월간에서 날짜 칸을 끌어 기간 일정 만들기(`b0277e9`·`6795444`), 종일·여러 날 일정 사선 무늬 `event-hatch`(월간·주간, `214cba0`), 코드 리뷰 수정(`8ed9f2b`), **막대 클릭 수정·끌어 이동·양 끝 늘이기**(`1f3bb24`, 문서 `fc8e06d`).

**`1f3bb24`의 내용**: 월간에서 ① 일정 막대를 눌러 수정 입력창 열기, ② 막대를 끌어 통째로 이동·종일 막대 양 끝으로 시작일/종료일 변경, ③ 끄는 동안 막대가 칸에 맞춰 새 날짜 자리로 옮겨 그려짐(여러 주 막대는 모든 주에서), ④ 막대는 5px만 움직여도 바로 끌기 시작. 파일: `app/[lang]/(app)/page.tsx`, `components/calendar/{month-select.tsx, week-selection.tsx, event-chip.tsx, day-cell.tsx, event-side-panel.tsx, week-editor.tsx, range-select-session.ts}`, `lib/calendar/selection.ts`.

**사용자 결정**: 막대 클릭 수정은 **B 방식**(월간 조회가 `description`까지 가져옴, 자르지 않음), 끌기는 **통째로 이동 + 양 끝 늘이기**, 놓은 뒤 표시는 **서버 저장 후 갱신**(낙관적 업데이트 없음, 새 자리 막대 미리 보기가 서버 응답까지 유지됨).

**구현 요점**
- 월간 페이지가 `WeekEditorProvider`(+`hint`, `hintEdit=""`)와 `MonthSelect events={editableEvents}`로 감싼다. 막대는 서버 컴포넌트 링크이고 `data-event-id`·`data-handle`(종일 막대의 진짜 양 끝만)만 달며, `MonthSelect`가 포인터·클릭을 **이벤트 위임**으로 처리한다(`onClickCapture`: 끌기 직후 클릭 억제 → 일반 왼쪽 클릭이면 `openEdit`, Ctrl·⌘·Shift·Alt·가운데 버튼은 링크대로, 데이터 없으면 링크대로).
- 끌기 세션 `range-select-session.ts`는 `startRangeSelect({pointerId, anchor|point, root, slopPx?, compute?, callbacks})`. 날짜 칸을 누르면 **다른 칸에 들어가야 시작**(한 칸 안 흔들림은 날짜 상세 이동), 막대는 `slopPx=5`. `compute`로 이동(`shiftSpan`)·시작일(`withStart`)·종료일(`withEnd`) 규칙을 넘긴다(`lib/calendar/selection.ts`). 칸 위치는 세션 시작 시 측정·캐시하고 스크롤·리사이즈에서 버린다. Esc(캡처, `stopPropagation`)·`blur`(끌기 중이면 클릭 억제)·`pointercancel`·`buttons===0` 처리.
- 저장은 기존 `updateEvent(id, {...fromEvent(event), startDate, endDate})`. 새 서버 입구 없음. 끄는 동안·저장 중의 막대 미리 보기는 `MonthSelect`의 `PreviewContext`(`BarPreview`: 구간·제목·색·무늬·줄)로 내려 주고, 각 주의 `WeekSelection`이 칩 레이어와 같은 격자(`top-9`, 4줄)에 `z-20`으로 그린다(`data-slot="month-bar-preview"`, 줄은 칩의 `data-lane`). 원래 막대는 `data-dragging`으로 흐려진다.
- 월간 종일·기간 막대에는 `event-hatch`(globals.css `@utility`), 주간 `EventBlock`도 같은 기준(`all_day || 시작날짜≠종료날짜`).

**확인한 것**: `tsc`·`lint`·`build` 통과, 순수 함수·세션 상태 흐름 임시 스크립트, **진짜 Chromium**: 실제 컴포넌트 전체(제공자·`MonthSelect`·`MonthGrid`/`WeekRow`/`DayCell`/`EventChip`·`buildMonthLayout`, `next/link`·서버 동작만 모의)로 20건(여러 주 막대 이동·늘이기 미리 보기가 모든 주에 그려짐, 저장 값, 저장 중 유지 → 새 데이터 도착 시 사라짐, 3px 클릭 = 수정창, 8px 제자리 = 무동작, 날짜 칸 끌기 회귀 없음). **사용자 확인(2026-10-29)**: 사용자가 실제 앱 화면에서 확인했다고 알리고 커밋을 요청함(항목별 결과는 듣지 못함). **따로 확인하지 못한 것**: 사선 무늬의 세기·가독성(8가지 색·다크 모드), 서버 응답까지의 지연 체감, 작은 화면, 수정 입력창 안내문 숨김, 키보드로 막대를 열었을 때 포커스. 사용자가 "복제 막대가 안 따라온다/하이라이트만 보인다", 이어서 "막대가 움직이지 않는다"고 보고함. Supabase 로그로 저장(`PATCH` 200)과 재조회는 정상임을 확인했고, 대상이 여러 주에 걸친 종일 일정이라 포인터를 따라다니던 복제 막대(한 주 조각 크기)가 원래 자리와 겹치거나 그리드 밖으로 삐져나와 움직이지 않는 것처럼 보였던 것으로 판단, 복제 막대를 없애고 칸에 맞춘 미리 보기로 바꿈(이 수정 뒤 사용자 확인을 받고 커밋).

**알려진 제한**: 양 끝 늘이기는 종일 막대만(여러 날 시간 일정은 이동만), 터치는 막대·날짜 칸을 길게 눌러 끌기(2026-10-30 추가, §16), 수정 중에 빈 칸을 끌면 새 일정 폼으로 교체, 월간 데이터가 커짐(설명 포함, 일정 상한 2,000건), 저장하지 않은 초안은 달 이동 시 남을 수도 사라질 수도 있음.

**진짜 브라우저 시험 방법**(작업 폴더는 `$CLAUDE_JOB_DIR/tmp`, 세션이 끝나면 지워지므로 필요할 때 다시 만든다): ① 임시 폴더에 `npm i jsdom esbuild playwright-core`, `npx playwright-core install chromium-headless-shell`. ② `esbuild`로 `@/…` 별칭(프로젝트 `tsconfig.json` 사용)을 풀어 클라이언트 컴포넌트를 번들하되 `@/components/calendar/week-editor`와 `@/lib/events/actions`는 `onResolve` 플러그인으로 모의 구현(`useWeekEditor` 값, `updateEvent`)으로 교체. 더 정확하게는 `week-editor`는 실제 것을 쓰고 `next/link`(→ `<a>`)와 `@/lib/events/actions`만 모의해, 실제 `WeekEditorProvider`·`MonthSelect`·`MonthGrid`(서버 컴포넌트지만 순수 JSX라 브라우저에서 그려짐)·`buildMonthLayout`·`ko.json`으로 그린다(데이터 갱신은 `root.render`로 새 events를 다시 넣어 흉내). ③ CSS는 `grep -l event-hatch .next/dev/static/chunks/*.css`(개발 서버) 또는 `.next/static/chunks/*.css`(빌드)로 찾아 복사. ④ Playwright `page.mouse.move/down/up`으로 입력해 `[data-slot="month-bar-preview"]`·`[data-dragging]` 등을 검사. 실제 앱 로그인은 운영 DB를 공유해 시험 계정을 만들지 않으므로, 실제 동작 확인은 Supabase 로그(`edge_logs`의 `PATCH /rest/v1/events`와 직후 재조회)로 보조한다.

**코딩 중 겪은 함정**: ESLint `react-hooks/refs`는 **렌더 중 ref 읽기를 금지**한다(끌고 있는 막대 정보는 상태로). `Write`로 파일을 덮어쓰기 전에 외부에서 바뀌었다면 "File has been modified since read"가 나므로 다시 `Read`한다. `getEventsForRange`는 `includeDescription`이 없으면 `description`을 주지 않는다. 서울 시간대 변환기(`Intl.DateTimeFormat`)는 `lib/calendar/date.ts` 모듈 상단에서 한 번만 만든다. `cn`은 tailwind-merge가 아니다(충돌 클래스는 직접 피한다).

**조정할 수 있는 값**(사용자가 요청하면): 미리 보기가 같은 줄의 다른 막대를 가리는 정도(`week-selection.tsx`의 `z-20`·`shadow-md`), 무늬 세기(`app/globals.css`의 `14%`·`5px`), 양 끝 잡는 부분 폭(`event-chip.tsx`의 `w-2`, 8px), 끌기 시작 거리(`month-select.tsx`의 `DRAG_SLOP_PX`). 후속 아이디어(요청 없음): 여러 날 시간 일정의 양 끝 늘이기, 터치 끌기.

## 15. 최근 작업: 날짜별 날씨·기온 표시(2026-10-30, 커밋·푸시 완료)

**요청**: 월간 그리드 날짜 옆에 날씨 아이콘, 주간 그리드 요일 앞에 날씨와 그 아래 작게 기온. **사용자 결정**: 지역=브라우저 위치(못 받으면 서울), 범위=오늘부터 약 2주 예보, 주간 기온=머리글 한 줄 아래. 월간은 아이콘만(기온은 툴팁)으로 이해해 구현함(사용자가 따로 정정하지 않음).

**커밋 `9a21635`(코드)·`cb8c550`(문서), 푸시 확인(`origin/main`과 같음). 변경 파일**: 새로 `lib/weather/{codes,forecast}.ts`, `components/weather/{weather-provider,weather-icon}.tsx`. 수정 `app/[lang]/(app)/{layout,page}.tsx`, `app/[lang]/(app)/day/[date]/page.tsx`(출처 표기, 스켈레톤 `3.5rem`), `components/calendar/{day-cell,week-grid}.tsx`, `next.config.ts`(`geolocation=(self)`), `lib/i18n/dictionaries/{ko,en}.json`(`weather` 섹션, 방침 3곳+시행일), 문서 4개.

**구현 요점**
- 데이터: `https://api.open-meteo.com/v1/forecast?daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Seoul&forecast_days=16`. 응답의 **마지막 날은 값이 null**이라 `parseForecast`가 날짜별로 건너뛴다. 좌표는 `roundCoord`로 소수 둘째 자리.
- `WeatherProvider`(`(app)/layout.tsx`)가 마운트 뒤 한 번만 받는다: `localStorage` 캐시(`weather:forecast`, 3시간, `isForecast`로 재검증) → 없으면 `navigator.geolocation`(거부는 `weather:geo-denied`에 7일 기록) → 서울 폴백 → `fetch`(8초). 실패하면 아이콘만 안 보임. 서버·DB는 위치를 모른다.
- 표시: `WeatherIcon`(lucide 8종, 색 `TONES`)은 데이터가 없으면 `null`. 월간 `DayCell`(서버 컴포넌트)에 클라이언트 잎으로 들어가며 `pointer-events-none`(칸 전체 링크를 가리지 않음, 시험으로 확인). 주간은 `WeekHeaderLink`(week-grid.tsx 안)로 머리글 칸을 빼고 기온 줄(`h-3`)을 항상 예약.
- 날씨 문구는 최상위 `weather` 사전 키(레이아웃이 `WeatherProvider labels`로 내림).

**확인한 것**: `tsc`·`lint`·`build`, 순수 함수 44건, 진짜 Chromium 28건(실제 컴포넌트, Open-Meteo 응답만 모의: 부산/서울 좌표, 월간·주간 표시, 캐시, 실패·이상한 응답, 높이 안정, 아이콘 위 클릭), 실제 Open-Meteo 응답 모양·CORS, 빌드 결과의 `Permissions-Policy` 헤더. 상세는 `calendar-verification.md` 27절. **확인하지 못한 것**(사용자 확인 대기): 실제 위치 허용 창과 내 지역 날씨, 다크 모드, 작은 화면 주간 머리글 폭, Safari·Firefox, 방침 문구.

**주의·제한**
- **운영 배포 확인 대기**: 푸시 직후(같은 날) `curl -I`로 본 운영 `Permissions-Policy`는 아직 `geolocation=()`이었다(배포가 끝나기 전으로 보임, 확정 아님). 배포 완료 뒤 `geolocation=(self)`로 바뀌었는지 다시 확인한다. 바뀌지 않으면 Vercel 배포 상태를 본다.
- **개발 서버를 재시작해야** `Permissions-Policy` 변경이 반영된다(`next.config.ts`). 재시작 전에는 위치 요청이 차단돼 서울 날씨만 보인다.
- **Open-Meteo 무료 이용은 비상업 용도·출처 표기 조건**이다(그리드 아래 "날씨 제공: Open-Meteo" 링크로 충족). 앱이 수익을 내면 유료 플랜이 필요하다. 서비스를 바꾸려면 `lib/weather/forecast.ts`(URL·파서)만 고치면 된다.
- 하루 단위 예보(시간대별 없음), 날씨 끄기 설정 없음, 첫 방문에 위치 허용 창이 뜸. 후속 아이디어(요청 없음): 설정에서 도시 선택·끄기, 섭씨/화씨.
- 조정 값: 아이콘 색·크기(`weather-icon.tsx`), 캐시 시간(`CACHE_TTL_MS`), 거부 기억 기간(`DENIED_TTL_MS`).

## 16. 최근 작업: 휴대폰·월간·주간 화면 개선(2026-10-30, 커밋·푸시 완료)

**커밋(모두 푸시됨, `origin/main`과 같음 확인)**: `7504f37`·`56ffb5f`(7일 한눈에·막대 글자 잘림), `fd75811`·`b3bc164`(한 화면 배치, 길게 눌러 끌기, 툴바·AI 버튼·기온·현재 시각·한 줄 이름), `a7d7ca6`·`65ae7bb`(주간 종일 줄 삭제), `9f81b8f`(월간 날짜 칸 터치 길게 눌러 만들기), `a88a22a`(새 일정 폼 종일 스위치 제거), `bbc77a6`(월간 +N 펼치기), `4274487`(문서). **주의: 이 절의 앞쪽 서술 중 "선택한 날 목록(`WeekAgenda`)"과 "`break-keep` 줄바꿈"은 이후 변경으로 삭제·대체됐다(아래 "휴대폰 그리드 한 화면" 문단이 최신).**

**요청**: 휴대폰에서 주간 그리드가 한눈에 안 보임(가로 스크롤로 3일만 보임) → 7일이 다 보이게. 사용자가 선택: **7일 압축 + 아래에 선택한 날 목록**. 추가 요청: 월·주 그리드의 **일정 막대 글자 위가 약간씩 잘림** → 세로 길이(줄 높이) 늘리기.

**커밋 `7504f37`(코드, 글자 잘림 수정 포함)·`56ffb5f`(문서), 푸시 확인(`origin/main`과 같음)**. 변경 파일: 새로 `components/calendar/week-agenda.tsx`. 수정 `components/calendar/{week-grid,block-text,event-block,event-chip,week-selection}.tsx`, `app/[lang]/(app)/day/[date]/page.tsx`(스켈레톤), `lib/i18n/dictionaries/{ko,en}.json`(`week.agendaLabel`·`noEventsOnDay`), 문서 4개.

**구현 요점**
- 폭은 `week-grid.tsx` 루트의 CSS 변수가 결정한다: 기본(휴대폰) `--day-min:0px`·`--time-col:2rem`, `sm:`(640px)부터 `6rem`·`4rem`. 모든 클래스는 "기본 = 휴대폰, `sm:` = 기존 모양"으로 썼다. `cn`이 충돌을 병합하지 않으므로 같은 속성은 `기본`과 `sm:`가 서로 다른 값으로만 겹치게 했다.
- 머리글 `WeekHeaderLink`: 휴대폰은 세로(요일/날짜/아이콘/붙여 쓴 최저/최고 기온 `7°/18°`, `tracking-tighter`), `sm:`부터 한 줄 + 아래 `최저° / 최고°`. 휴대폰 높이 `4.75rem`(스켈레톤 동일).
- 목록 `WeekAgenda`: `WeekGrid`가 `Object.values(eventsById)`(낙관적 덮어쓰기 반영)를 넘긴다. 서버 작업 없음. 머리글을 누르면 `/day/날짜`로 이동해 목록이 바뀐다(서버 왕복).
- **막대 글자 잘림 원인**: 막대의 `leading-none`(줄 높이 = 글자 크기)과 제목의 `truncate`(overflow hidden)가 겹쳐 한글 윗부분이 잘림 → 제목·시각 span에 `leading-snug`. 막대 높이(`h-6`, 오버레이 `top-9`·4줄)는 건드리지 않았다.
- 좁은 열의 제목 줄바꿈은 `break-keep [overflow-wrap:anywhere]`(단어 단위, 너무 길면 글자 단위).

**확인한 것/못 한 것**: `calendar-verification.md` 28절(휴대폰 에뮬레이션 52건). **사용자 확인 대기**: 실제 휴대폰, 글자 잘림 해소, 목록·입력창 모양. **시험 팁**: 하네스 페이지에 `<meta name="viewport" content="width=device-width, initial-scale=1">`가 없으면 `isMobile` 에뮬레이션이 980px로 그려 `sm:` 스타일이 적용된다(앱에는 메타가 있음).

**월간 "+N" 버튼으로 주 펼치기(같은 날, 푸시 완료)**: 종일 일정이 많아 3줄을 넘으면 +N을 눌러 그 주만 모든 일정이 보이게 펼친다(`expandable-week.tsx`, `week-row.tsx`, `event-chip.tsx`의 `collapsed`, `day-cell.tsx`·`week-selection.tsx`의 `--week-rows`, 사전 `calendar.collapse`). 이전의 "더 보기 → 날짜 상세 이동" 링크는 버튼으로 바뀜. **새 일정 폼의 종일 스위치 제거(같은 날, 푸시 완료)**: `event-form.tsx`에서 `mode === "edit"`일 때만 스위치, 새 종일 일정은 시각 입력 숨김(`showTimes`). 월간 생성은 종일 그대로(사용자 결정). **월간 날짜 칸 터치 길게 눌러 기간 만들기(같은 날, 푸시 완료)**: `month-select.tsx`(날짜 칸 터치 분기), `range-select-session.ts`(`startActive`), `day-cell.tsx`. §14 "알려진 제한"의 "터치는 끌기 없음"은 이제 해소(막대·날짜 칸 모두 길게 누르기). iPhone Safari 시험 안 함. **주간 "종일" 줄 삭제(같은 날, 푸시 완료, 웹·모바일 모두)**: `week-grid.tsx`에서 종일 줄·`AllDayBarItem` 제거, 사전 `week.allDay`·`allDayEvent` 제거, 스켈레톤의 종일 행 제거(사용자 결정). **종일·여러 날 일정은 주간 화면에서 안 보이고 월간에서만 본다**(되돌리려면 `git log`의 `AllDayBarItem` 이전 커밋 참조). 위 §16 앞쪽의 종일 줄 관련 서술은 과거 기록. **휴대폰 그리드 한 화면(같은 날, 푸시 완료)**: "선택한 날 목록(`WeekAgenda`)"을 삭제하고 **페이지·그리드 모두 스크롤 없이** 맞춤(`day/[date]/page.tsx`의 `WEEK_PAGE_CLASS`로 main 높이 고정 + `week-grid.tsx`가 flex로 남은 높이를 채움, `week-body`는 `minHeight`, `--hour-h` 최소 0.875rem; "주간 일정" 제목은 휴대폰에서 `sr-only`; 휴대폰 터치에서는 크기 조절 핸들 미사용 `isPhoneTouch`), 시간 눈금은 휴대폰에서 2시간 단위, **일정 이름은 모바일·웹 모두 한 줄 + 넘치면 `…`**(`week-grid.tsx`의 `TimedBlock`·`EarlyChip`, `block-text.tsx`, 월간은 원래 `truncate`), 45분 미만 블록은 휴대폰에서 9px. §16 앞쪽의 목록 설명은 과거 기록. **터치 길게 눌러 끌기(같은 날, 푸시 완료)**: 일정 블록·월간 막대를 약 0.4초 길게 누르면 떠올라 끌기 시작(`components/calendar/long-press.ts`, `event-block.tsx`, `month-select.tsx`, `drag-session.ts`의 `DragPointer`). 문지르면 스크롤. **iOS Safari 시험 안 함, 사용자 확인 대기**. 월간 날짜 칸 끌기는 터치 미지원 그대로. **AI 채팅 버튼(같은 날, 푸시 완료)**: 휴대폰(sm 미만)에서 상단 바의 로고와 메뉴 버튼 사이로 이동(`ai-widget.tsx`), sm 이상 그대로. **현재 시각 줄 라벨(같은 날, 푸시 완료)**: 휴대폰에서 "오전 10:35"의 "오전"이 잘리던 것을 24시간제 `10:35`로(`now-line.tsx`). 줄 자체는 이번 주를 볼 때 06~24시에만 보인다. **주간 툴바(같은 날, 푸시 완료)**: 휴대폰에서 [이전·오늘·다음] [월간 보기] [일정 추가]를 한 줄로(`week-toolbar.tsx`, `new-event-button.tsx`의 `compact`, `max-sm:` 변형 사용). 머리글 기온도 휴대폰에서 최고만 → 붙여 쓴 최저/최고(`7°/18°`)로 바뀜(미커밋). 둘 다 사용자 확인 전.

**제한·후속 아이디어(요청 없음)**: 열이 약 45~50px라 블록 제목은 3~4글자, 태블릿 폭(640~800px)은 여전히 가로 스크롤(`--day-min`을 중간값으로), 목록 선택을 클라이언트 상태로 즉시 전환, 월간도 휴대폰에서 일정 목록 제공.

## 17. 최근 작업: 일정 장소·링크 + 카카오맵, AI 버튼 끌기, 모바일 시트·주간 그리드(2026-11-02, 커밋 완료·푸시 전)

**요청**: 주간·월간 모두 일정에 주소를 저장하고, 일정을 누르면 지도로 장소를 보여 주고, 링크도 저장. **사용자 결정**: 지도는 **카카오맵**, 표시는 **기존 수정 창 안**(읽기 전용 상세 창 없음).

**구현**: 마이그레이션 `20261102000000_event_location_url.sql`(`events.location`·`url`, null 허용, 길이 200/2000·`url ~* '^https?://'` CHECK `not valid`, 롤백 SQL 주석). `lib/events/input.ts`(`location`·`url` 필드, `LOCATION_MAX`·`URL_MAX`, `normalizeUrl`: 스킴 없으면 `https://`, `http(s)`만 허용, 새 오류 코드 `locationTooLong`·`urlTooLong`·`urlInvalid`), `queries.ts`(select에 두 컬럼; `includeDescription` 조회에만), `event-form.tsx`(장소·링크 입력, 링크 열기 `rel="noreferrer noopener"`, 표시도 `normalizeUrl` 통과분만), 새 `components/calendar/event-map.tsx`(카카오 SDK를 지도가 필요할 때 한 번만 동적 로드, 주소 검색 → 실패 시 키워드 검색, 0.5초 지연, 실패·키 없음·못 찾음은 안내 + "카카오맵에서 보기" 링크), 사전 `eventForm` 키·방침(수집 항목 "장소, 링크", 위탁 목록 "Kakao 지도").

**AI**: `lib/ai/tools.ts`는 장소·링크를 다루지 않는다. 새 초안은 빈 값, 수정 초안은 `before` 값 유지(`EVENT_COLUMNS`에 두 컬럼 추가).

**⚠️ 배포 순서**: ① 카카오 콘솔 Web 플랫폼에 `http://localhost:3000`·운영 주소 등록 + 카카오맵 사용 설정 + JavaScript 키 확인 ② 키를 `.env`·Vercel에 `NEXT_PUBLIC_KAKAO_MAP_KEY`로 입력(사용자가 직접) ③ **마이그레이션을 Supabase SQL 편집기에서 먼저 실행** ④ 푸시. 마이그레이션 전에 새 코드가 뜨면 일정 조회·저장이 실패한다(운영·개발 DB 공유).

**확인한 것/못 한 것**: `tsc`·`lint`·`build` 통과, `normalizeUrl`·`toPayload` 임시 스크립트(`example.com`→`https://example.com/`, `javascript:`·`data:`·`ftp:` 거절, 200자 초과 거절, 빈 값→null). **못 한 것**: 실제 카카오 키로 지도 표시와 한국 주소·가게 이름 검색 정확도, 입력 폼의 실제 화면(Playwright 시험 안 함), 휴대폰 하단 시트 안 지도 스크롤 간섭, 마이그레이션 SQL 실행(MCP 읽기 전용).

**장소 후보 드롭다운(같은 날 추가)**: `components/calendar/place-input.tsx`(combobox, 0.3초 지연, 키워드→주소 검색 최대 5개, ↑↓·Enter·Esc), `event-map.tsx`의 `searchCandidates`·`EventMap coords`(고른 후보의 좌표를 그대로 사용). 실제 카카오 키로는 아직 시험 못 함(휴대폰 시트에서 목록이 잘리는지 포함).

**AI 버튼 끌어서 옮기기(같은 날, 커밋 `95ff18a`)**: `components/ai/ai-widget.tsx`. 5px 넘게 끌면 이동, 그보다 작으면 기존 열기·닫기. 포인터는 누르는 순간부터 붙잡는다(`setPointerCapture`, 처음엔 임계값 뒤에 붙잡아 빠르게 끌면 움직임을 놓쳤음). 위치는 화면 안의 비율(0~1)로 `localStorage` `ai-button-pos`에 저장하고 창 크기가 바뀌면 다시 맞춘다. React 상태가 아니라 버튼의 `style`(left/top)에 직접 쓴다. 휴대폰 터치는 `touch-none`. 한계: 키보드로 옮기기·초기화 기능 없음(저장소 삭제로만), PC에서 옮겨도 채팅 팝업은 오른쪽 아래 고정. iPhone Safari 시험 안 함.

**모바일 일정 수정 시트 겹침 수정(커밋 `6740240`)**: 원인 둘. ① 폭 640px 이상(태블릿·가로 모드)에서 오른쪽 아래 AI 버튼이 시트·사이드바의 입력칸과 저장 버튼을 덮음(끌기 기능으로 휴대폰에서도 가능해짐) → 수정 창이 열려 있는 동안 AI 버튼을 숨김(`[body:has([data-slot=event-side-panel])_&]:hidden`). ② 저장·삭제 줄이 스크롤 내용 맨 아래라 화면 밖(390×844에서 y=1043) → `event-form.tsx`에서 스크롤 영역 밖 고정 푸터로 분리. 크기: 시트 `max-h-[50dvh]`→`58dvh`, 그리드 여백 `pb-[52dvh]`→`60dvh`(`week-editor.tsx`), 휴대폰 여백·간격 축소, 설명 칸 4줄→3줄. 한계: 360×640에서는 보이는 영역이 약 270px라 스크롤 필요, 장소 후보 드롭다운이 스크롤 영역 안이라 아래쪽에서는 잘릴 수 있음(미확인), iOS 키보드가 올라올 때 모양 미확인. **디버깅 팁**: 이 하네스(`ai/`)는 `process.env.NEXT_PUBLIC_KAKAO_MAP_KEY`를 esbuild `define`에 넣어야 한다(없으면 `process is not defined`).

**모바일 주간 그리드 세로 2배(커밋 `f5de42e`, 사용자 요청)**: 휴대폰(640px 미만)의 `--hour-h`를 `max(1.75rem, calc((100dvh - 23.375rem) * 2 / 18))`로 바꿔 시간 눈금 본문 높이가 "한 화면에 딱 맞던 높이"의 정확히 2배(390×844에서 470→940px, 360×640에서 266→532px)가 되었다. 그리드 카드는 화면 높이 그대로이고 **그리드 안에서 세로 스크롤**하며 머리글·"6시 이전" 줄은 sticky. 페이지 자체는 스크롤 없음. `23.375rem`은 상단 바·툴바·머리글 높이 합(측정값 374px), `18`은 `HOURS`라 그 값들이 바뀌면 함께 고친다. **§16의 "스크롤 없이 한 화면에 맞춤" 서술은 이 변경으로 대체됐다(시간 높이만 2배, 카드·페이지는 한 화면 고정 그대로).** 후속 후보: 열 때 지금 시각 근처로 자동 스크롤(현재는 맨 위). 이전 한 화면 맞춤으로 되돌리려면 `--hour-h`를 `0.875rem`으로.

**제한·후속**: 좌표를 저장하지 않아 열 때마다 검색 1회(첫 결과 사용), 주간 블록·월간 칩에는 장소 표시·`aria-label` 없음, AI 일정 생성은 장소·링크 미지원, CSP 도입 시 `dapi.kakao.com`·지도 타일 도메인을 열어야 함. 알려진 사소한 점: `javascript:1`처럼 포트 모양이면 `https://javascript:1`로 보정됨(안전하나 의미 없는 주소).

## 18. 최근 작업: 관리자 영역(/admin)·프로필·통계 대시보드(2026-11-02, 커밋 완료·푸시 전)

**요약**: `profiles` 테이블(역할·멤버십·이메일), 일반 앱과 분리된 `/admin` 영역(접근 제어, 개발 점검 페이지, tweakcn modern-minimal 테마), 통계 대시보드(`/admin/dashboard`), 일별 로그인 횟수 기록. **사용자 결정**: DB 트리거·함수는 요청할 때만 쓴다 → 프로필 행 만들기와 로그인 횟수 증가, 통계 집계는 모두 **앱 서버 코드(service role)**로 한다(§7, 메모리 `db-triggers-only-when-asked`).

**DB(모두 적용·확인함, 2026-11-02 읽기 전용 조회)**
- `20261102000001_profiles_role.sql`: `profiles(user_id PK → auth.users on delete cascade, email, role, membership, created_at)`. RLS는 **본인 행 읽기만**(쓰기 정책·권한 없음: 사용자가 자기 역할을 못 바꿈). 행이 없으면 일반 사용자(user/free)로 본다.
- `20261102000002_profiles_enums.sql`: `role`을 enum `user_role('user','admin')`, `membership`을 enum `membership_tier('free')`로 변환(role과 membership은 **서로 독립**: 권한 vs 요금제). 등급 추가는 `alter type public.membership_tier add value 'pro';`(같은 실행 안에서 새 값을 바로 쓸 수 없어 따로 실행). 관리자 지정은 SQL 편집기에서 `insert into public.profiles (user_id, role) select id,'admin' from auth.users where email='…' on conflict (user_id) do update set role='admin'`(앱에서는 역할 변경 UI 없음).
- `20261102000003_admin_stats.sql`: `app_settings(key, value jsonb, updated_at, updated_by)`(AI 요금 단가 `ai_pricing` 저장). 원래 있던 집계용 DB 함수 3개는 **사용자 요청으로 삭제**(적용된 적 없음).
- `20261102000004_daily_logins.sql`: `daily_logins(user_id, day(서울), count)` PK `(user_id, day)`. 두 테이블 모두 RLS 켜고 정책 없음·권한 회수(서버 service role만).

**프로필 행 만들기**: `lib/profile/ensure-profile.ts`의 `ensureProfile(user)`가 service role로 `user_id`·`email`만 upsert(role·membership은 덮어쓰지 않음). 호출: 이메일 가입(이미 가입된 이메일 걸러낸 뒤), 이메일 로그인, 게스트 시작, 게스트 이메일 전환, `/auth/callback`(Google·확인 링크). 실패해도 로그인·가입은 막지 않고 로그(`[profile]`)만 남긴다. **로그인할 때마다 한 번 더 채우는 것이 누락 안전망**. 신규 가입 자동 생성 트리거는 쓰지 않는다.

**일별 로그인 횟수**: `lib/profile/record-login.ts`의 `recordLogin(userId)`. 서울 날짜 기준 (사용자, 날짜) 행의 `count`를 1 올린다. **락 없이 낙관적 갱신**(`update … where count = 읽은 값`, 갱신된 행이 0이면 다시 읽고 재시도, 최대 5번; 첫 로그인 동시 insert의 `23505`도 같은 경로). 서로 다른 사용자는 다른 행이라 충돌 없음. 세는 것: 이메일 로그인, 바로 로그인되는 이메일 가입, 게스트 시작, `/auth/callback`(게스트의 계정 전환 `upgrade=1`은 제외). 세지 않는 것: 이미 로그인된 채의 재방문, 페이지 열기. **기록은 배포한 날부터만 쌓인다**(과거 소급 불가: Auth 감사 로그가 꺼져 있고 세션은 로그아웃하면 지워짐). 동시 로그인 시험은 하지 못함.

**접근 제어(이중)**: ① `proxy.ts`가 `/admin`·`/admin/*`를 먼저 확인: 세션(`getClaims`) + `profiles.role='admin'`, 게스트 제외, **운영(`NODE_ENV=production`)에서는 관리자가 아니면 `/ko/404`로 rewrite**(경로 존재를 숨김), 개발 서버에서는 통과시켜 페이지가 원인을 보여 줌. 응답에 `cache-control: no-store`, `x-robots-tag: noindex`. ② 페이지·Server Action이 `lib/admin/require-admin.ts`의 `getAdmin()`으로 **다시 확인**(Auth 서버 `getUser` 기준, 사용자 권한으로 자기 `profiles` 행만 읽음). **관리자 Server Action은 반드시 `getAdmin()`을 직접 호출**해야 한다(layout만 막으면 우회됨). `lib/supabase/proxy.ts`의 `updateSession`이 `supabase` 클라이언트도 반환하도록 바뀜.

**분리된 레이아웃**: `app/admin/layout.tsx`가 두 번째 루트 레이아웃(`app/layout.tsx` 없음, `app/[lang]/layout.tsx`와 별개). 언어 접두사·사이드바·환영 인트로 없음, 한국어만(사전 파일 미사용), `noindex`, 일반 앱과 오갈 때 전체 새로 불러오기. **테마**: tweakcn modern-minimal을 `npx shadcn add`로 `globals.css`에 쓰지 않고 `app/admin/admin-theme.css`에 `html.admin-theme`(라이트)·`html.admin-theme.dark`(다크, 앱에 `.dark`를 켜는 코드가 없어 현재 미사용) 범위로 옮김. 폰트는 Inter·JetBrains Mono를 관리자 레이아웃에서만 `next/font`로 불러오고, 앱의 `@theme inline`이 `--font-geist-*`를 값으로 참조하므로 `admin-theme.css`가 이 두 변수를 `--font-inter`·`--font-jetbrains-mono`로 연결. `app/globals.css`는 변경 없음(일반 앱은 베이지·주황 그대로, 헤드리스로 확인).

**화면**
- `/admin`(점검, `app/admin/page.tsx`): 관리자 확인 결과, 마스킹한 이메일, 사용자 ID 앞 8자리, 역할/멤버십, service role 연결(profiles 행 수), Supabase 호스트, 환경 변수 **설정 여부만**, 실행 모드, **"구현 예정 기능" 목록**(`PLANNED`의 `status`로 예정/완료 배지; 대시보드로 만든 3개(AI 사용량·비용, 가입·활동, 알림 발송), 사용자 목록, AI 사용 제한 조정은 `"done"`(사용자 판단으로 완료 처리), 나머지 8개는 `"planned"`).
- `/admin/dashboard`: 기간 7·14·30일 선택(`?days=`). 오늘 요약 타일(오늘 로그인한 사용자·오늘 로그인 횟수·오늘 AI 질문·오늘 알림 성공), 가입·활동·AI·알림 섹션. **`StatCard`(`stat-card.tsx`)**: 라벨·큰 숫자·이전 기간 대비 증감·일별 곡선 그래프(SVG, 라이브러리 없음, 점 반지름 1.5, 점이 많으면 마지막 점만). 집계가 **선택 기간의 2배**를 읽어 앞 절반을 이전 기간으로 비교(`halves`). 사용자별 AI 상위 10명 표(이메일 마스킹, 게스트는 "게스트"), 알림 상태별 건수·사유 상위 10·10분 넘게 지연된 대기/발송 중 경고.
- **AI 요금 단가**: 페이지에서 입력 단가($/100만 토큰)·출력 단가·환율(원/$)을 저장하면 `app_settings('ai_pricing')`에 저장되고 예상 비용에 반영(`lib/admin/pricing.ts`, `app/admin/actions.ts`의 `savePricing`: `getAdmin()` 확인·0~100000 범위 검증). 출력 토큰은 추론 토큰을 더해 계산. 단가는 사용자가 입력(코드에 값 없음).

- **AI 사용 제한(대시보드 맨 위 고정 바, 사용자 결정)**: 모든 사용자에게 같은 **사용자당 하루(서울 0시 기준) AI 사용 금액(원) 한도**를 **슬라이더 드래그**로 정한다(`app/admin/dashboard/cost-limit-bar.tsx`; 10~2,000원, 10원 단위, "제한 없음" 체크). 입력·출력 토큰 단가가 달라 **토큰 수가 아니라 금액** 기준(처음엔 토큰 기준으로 만들었다가 바꿈). 값은 `app_settings('ai_cost_limit')` `{dailyKrwPerUser}`(서버 액션 `saveCostLimit`, `getAdmin()`·범위 검증). **적용**: `app/api/ai/route.ts`가 질문을 받으면 질문 횟수 한도(`consume_ai_quota`)를 쓰기 전에 `lib/ai/cost-limit.ts`의 `isOverDailyCostLimit(userId)`로 오늘 `ai_usage` 합계를 `estimateCost`(저장된 AI 요금 단가)로 금액 환산해 한도 이상이면 429 `usageLimited`("오늘 AI 사용량을 모두 썼어요. 내일 다시 시도해 주세요.", ko·en `ai.errors.usageLimited`). **한도가 없거나 단가가 저장돼 있지 않거나 조회에 실패하면 막지 않는다**(가용성 우선; 단가가 없으면 바에 붉은 안내). 사용량은 질문이 끝난 뒤 기록되므로 한도를 한 질문 분량 정도 넘을 수 있다. 막대에는 오늘 가장 많이 쓴 사용자의 금액·한도 대비 %·"질문 약 N회 분량"을 표시(`stats.ts`의 `today_users`). 게스트도 같은 한도(질문 횟수가 하루 3회라 영향 적음). **한도 초과 차단 흐름은 시험하지 못함**(운영과 DB 공유라 사용량을 채울 수 없음), 슬라이더 동작은 헤드리스로 확인.
- `/admin/users`(사용자 목록, 읽기 전용, 사용자 확인 완료): 요약 타일(전체·정식·게스트, 최근 7일 로그인, 관리자 수, 이메일 미확인), 필터(전체·정식·게스트·관리자), 정렬(가입일·최근 로그인), 검색(전체 이메일 또는 사용자 ID 앞부분, GET 폼), 20명씩 쪽 나누기. 표: 마스킹한 이메일(게스트는 "게스트")·ID 앞 8자리, 로그인 방식(이메일·Google·게스트, "이메일 미확인" 배지), 역할/등급, 가입일, 마지막 로그인(서울 시간), 일정 수(개수만), 카카오 상태(연결됨·재연결 필요), 푸시 구독 수. 계정은 `listUsers` 전체(최대 2만 명)를 읽고, 일정·카카오·푸시는 **보이는 20명 분만** 읽는다(`lib/admin/users.ts`, 표시 도우미 `users-format.ts`, 표 `app/admin/users/user-table.tsx`). 쓰기 기능(정지·삭제·역할 변경)은 없음.

**집계(`lib/admin/stats.ts`, 서버 전용)**: 가입은 Auth Admin API `listUsers`(1000명씩, 최대 20쪽), 나머지는 `events`·`ai_usage`·`notifications`·`daily_logins`를 REST로 읽어 서버에서 센다(`lib/admin/fetch-all.ts`의 `fetchAll`이 1000행씩 나눠 읽고 **최대 2만 행**, 서울 날짜 기준). 매우 커지면 느려질 수 있어 그때 DB 쪽 집계를 다시 검토. "오늘 로그인한 사용자"·"최근 7일 로그인 사용자"는 `last_sign_in_at` 기준(과거에도 정확).

**확인한 것**: `tsc`·`lint`·`build`, DB 적용 상태(읽기 전용), 집계 쿼리 본문 3개를 실제 DB에 읽기로 실행해 결과 모양 확인(함수 도입 때), 서울 날짜 경계 계산, 카드 4개 헤드리스 렌더링(스크린샷), 테마 적용 범위(헤드리스), 운영 빌드에서 로그인 없는 `/admin`·`/admin/x`가 404. **확인하지 못한 것**: 관리자로 로그인한 실제 `/admin`·`/admin/dashboard` 화면과 숫자, 단가 저장 후 비용 계산(저장 행은 존재), 동시 로그인 횟수, 로그인 기록이 실제로 쌓이는지(배포 후 `daily_logins` 조회로 확인), 운영 배포에서 Inter 폰트, 휴대폰 화면.

**조회 중 발견(원인 미확인)**: 대기 중 알림 16건 중 10건이 발송 시각이 10분 넘게 지났는데 `pending`(2026-10-30 기준). 알림 워커(pg_cron) 동작 여부 확인 필요. 대시보드가 이런 경우 경고를 띄움.

**남은 구현 예정**(`PLANNED`, 8개): 정리 작업 현황, 오류 모음, 계정 정지·삭제(확인 단계·변경 기록 필요, DB 백업 없음), 다른 사용자 일정·AI 대화 열람(개인정보 방침 고지 필요라 보류 권장), 공지·점검 배너, 문의·신고 접수함, 기능 플래그, 시스템 설정 편집. 관리자 역할을 화면에서 바꾸는 기능은 없음(만들면 자기 자신·마지막 관리자 해제 방지와 변경 기록 필요).

**알려둘 점**: 계정 삭제 시 `profiles`·`daily_logins` 행도 cascade로 사라져 과거 합계가 조금 줄어든다. 관리자 지정 이메일은 마이그레이션 주석의 SQL에서 직접 바꿔 실행. `.playwright-mcp/`는 `.gitignore`에 추가됨.
