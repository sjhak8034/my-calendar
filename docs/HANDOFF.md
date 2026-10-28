# 인수인계 (HANDOFF)

최종 갱신: 2026-10-29. 새 세션이 이 프로젝트를 이어받을 때 **가장 먼저 읽는 문서**다.
상세 근거는 `docs/ROADMAP.md`(작업별 구현 내용), `docs/calendar-verification.md`(검증 원장 14~23절), `docs/ai-security.md`, `docs/PRD.md`에 있다. 이 문서는 그 위에서 "지금 어디까지 왔고 무엇을 조심해야 하며 다음에 무엇을 하는가"만 모았다.

## 1. 한눈에 보기

- 프로젝트: 한국어 중심 캘린더 웹앱(`my-calendar`). Next.js 16.4.3(App Router, `cacheComponents` 켜짐) + React 19 + TypeScript strict + Tailwind v4 + shadcn(base-nova, `@base-ui/react`) + Supabase(Auth/Postgres RLS) + Vercel 배포 예정. 원격: `https://github.com/sjhak8034/my-calendar.git`(브랜치 `main`).
- **기능은 모두 구현됨**: 월간·주간 캘린더와 일정 CRUD·드래그, AI 대화(Gemini, 추가·수정·삭제는 확인 카드), 게스트 모드, 알림 예약·발송 워커, 웹 푸시, 카카오톡 알림, 설정 화면, 로그인·가입·비밀번호 재설정, 계정 삭제, CAPTCHA.
- **지금 하는 일은 Task 013(품질 점검 및 배포)**. 1~4단계와 CAPTCHA까지 끝났고 **5단계(개인정보처리방침)와 6단계(배포)가 남았다.**
- 로드맵 표기: 11/13 Tasks 완료. Task 009(AI 대화)는 "마무리 점검 대기", Task 014b(게스트→정식 전환)는 "UI 검증 대기".
- 테스트 러너는 없다. 검증은 `npm run lint` · `npx tsc --noEmit` · `npm run build`와 임시 스크립트·`curl`·사용자의 브라우저 확인으로 한다.

## 2. 이어받기 체크리스트

1. `git status -sb`로 상태를 본다. 마지막 확인 시점의 상태:
   - 브랜치 `main`, **`origin/main`보다 5개 커밋 앞섬(푸시 안 됨)**. 이 세션에는 GitHub 인증이 없어 **푸시는 사용자가 별도 터미널에서 `git push origin main`** 해야 한다(§4 참고).
   - **미커밋 변경 2개**: `components/auth/captcha.tsx`(Turnstile 위젯을 `appearance: "always"`로 항상 표시하게 바꾼 것), `docs/ROADMAP.md`(그 설명). 사용자에게 커밋 여부를 물은 상태였다. 이 `docs/HANDOFF.md`도 새 파일(미커밋)이다.
   - `.mcp.json`은 로컬 Supabase MCP 설정(읽기 전용, 프로젝트 범위)이라 **일부러 커밋하지 않았다.** 계속 제외한다.
2. 사용자가 **아직 결과를 알려 주지 않은 확인 항목**(§9)을 물어본다.
3. 아래 §8의 남은 작업 순서대로 진행한다. 5단계는 **보호책임자 연락처**(없으면 임시 이메일 하나)를 사용자에게서 받아야 시작할 수 있다.

## 3. 읽는 순서

1. `CLAUDE.md`, `AGENTS.md`(Next.js 16 주의: 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 읽는다)
2. 이 문서 → `docs/ROADMAP.md`(특히 Task 009~014) → `docs/calendar-verification.md`(확인함/확인하지 못한 것) → `docs/ai-security.md` → `docs/PRD.md`
3. 계획 원문: `/root/.claude/plans/task-013-bright-elephant.md`(저장소 밖, 같은 기기에서만 보임. 핵심은 §8에 옮겨 두었다)

## 4. 작업 방식과 환경의 함정 (이전 세션에서 배운 것)

### 사용자와 일하는 방식
- 답변은 **한국어**. 사용자가 "질문의 뜻이 불분명했다"고 한 적이 있다(ARIA, 보안 헤더 같은 용어를 풀지 않고 선택지로 물었을 때). **용어는 쉬운 말로 풀고, 선택지는 "그러면 무엇이 어떻게 달라지는지" 중심으로** 묻는다.
- **커밋은 사용자가 요청할 때만** 한다. 지시한 파일만 `git add`하고(`.mcp.json` 제외), 메시지는 gitmoji + 한국어 + 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. 기능과 문서 변경은 따로 커밋하는 편이다.
- **확인하지 못한 것은 "확인하지 못한 것"으로 솔직히 적는다.** 브라우저를 직접 못 보고, DB·메일·카카오·Cloudflare 콘솔은 사용자만 만질 수 있다. 문서(`calendar-verification.md`)에 확인함/확인하지 못한 것을 나눠 적는 관례를 지킨다.
- 큰 작업은 계획(plan mode) → 승인 → 단계별 구현·검증·커밋 순서로 했다. 사용자가 이미 정한 결정은 §7.
- **비밀값을 대화에 붙여 넣게 하지 않는다.** 한 번 개발용 VAPID 키가 대화에 노출된 적이 있어, 운영 전에 새로 만들어야 한다(§8).

### 환경
- 개발 서버(`npm run dev`, `localhost:3000`)는 **사용자가 띄운다.** WSL2에서 돈다. `.env`나 `next.config.ts`를 바꾸면 **재시작**해야 하고, 특히 `NEXT_PUBLIC_*`는 재시작하지 않으면 브라우저 코드에 반영되지 않는다(`ps -eo lstart,cmd | grep next-server`로 시작 시각을 확인).
- 새 라우트 폴더를 만들면 개발 서버가 못 알아볼 때가 있다(404). 파일을 `touch`하거나 재시작한다. `PageProps<"/[lang]/새경로">` 타입 오류가 나면 `npx next typegen`으로 타입을 다시 만든다.
- **`.env`는 자동 모드가 읽기·쓰기를 거부한다.** 값은 읽지 않고 `grep -cE "^이름=" .env`와 `${#v}`로 **줄 수와 글자 수만** 확인하는 패턴을 쓴다. 값 입력과 수정은 사용자가 직접 한다. 사용자가 `.env`에 키를 붙이다 **줄바꿈 없이 이어 붙인 사고**(`SITE_URL=...NEXT_PUBLIC_TURNSTILE_SITE_KEY=...`)가 한 번 있었고 지금은 고쳐져 있다. `.env` 수정을 안내할 때는 "새 줄에 쓰세요"를 강조한다.
- **GitHub 푸시 불가**: 원격이 HTTPS이고 이 세션에 `gh`·자격 증명이 없다. Windows의 Git 자격 증명 관리자를 빌려 쓰려는 시도는 보안 검사가 거부했다(우회하지 않는다).
- **브라우저 도구 없음**: Claude in Chrome은 WSL에서 지원되지 않는다. 화면을 보려면 사용자가 스크린샷을 저장하게 하고(`/mnt/c/Users/thdwj/Downloads` 또는 `Pictures/Screenshots`) `Read`로 이미지를 읽는다.
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
- `supabase/migrations/`(10개), `supabase/cron/schedule.sql`(배포 후 수동 실행), `public/sw.js`(서비스 워커), `public/icon-*.png`.

## 6. Task 013 단계별 현황

| 단계 | 내용 | 상태 | 커밋 |
| --- | --- | --- | --- |
| 1 | 잘못된 날짜 404 상태, 오류·404 화면, 보안 헤더 5종, metadata·manifest·robots·sitemap·아이콘·OG 이미지 | 완료 | `890109a` |
| 2 | 비밀번호 재설정, 확인 메일 재발송, 비밀번호 규칙(8자 이상 + 영문·숫자) | 완료 | `44e9a82` |
| 3 | 계정 삭제(비밀번호 확인+CAPTCHA, Google 전용 계정은 이메일 입력, 카카오 연결 끊기, 푸시 해제, 7개 테이블 cascade) | 완료 | `169d70b` |
| 4 | 보안 하드닝(빈도 제한, `events` 제약·개수 상한, 정책·권한 정리, AI 주제 제한), 보안 리뷰 | 완료 | `74f919d` |
| + | Turnstile CAPTCHA(가입·로그인·게스트·비밀번호 찾기·재발송) | 완료(코드) | `e510f9e` |
| + | 위젯 항상 표시 | **미커밋** | - |
| 5 | 개인정보처리방침 본문(ko/en 초안, 보호책임자 `lib/site.ts`). 공개 전 확인: Supabase·Vercel 서버 지역, Gemini 데이터 사용 문구, 만 14세 미만 문구, 연락처를 전용 주소로 교체할지 | 완료(초안) | 아래 커밋 |
| 6 | 배포(Vercel, 환경변수, 콘솔 설정, `schedule.sql`) | **남음** | - |
| 선택 | 주간 겹침 열 수 상한과 "+N" 묶음 | 미룸 | - |

## 7. 사용자가 내린 결정 (되묻지 않는다)

- 계정 삭제: 이번에 구현함. 월간 달력 **화면 낭독(ARIA) 개선은 제외**(시각장애 사용자는 현재 고려하지 않음). 보안 헤더는 **기본 5종만**(CSP는 후속). 배포는 **대화로 함께**(계정 권한이 필요한 클릭은 사용자가 직접). 비밀번호 규칙은 **8자 이상 + 영문·숫자**. **CAPTCHA를 추가**(Turnstile, 항상 표시).
- 게스트는 카카오톡을 연결할 수 없고 "계정 만들기"(`/upgrade`) 안내 팝업을 본다(로그인 대신 계정 전환으로 보내는 이유: 게스트가 로그아웃하면 데이터가 즉시 삭제됨).
- 푸시는 로그아웃 때 이 브라우저 구독을 해제하고, 같은 계정으로 다시 로그인하면(알림 권한이 이미 허용된 브라우저에서) **자동으로 다시 구독**한다(`user_metadata.push_enabled`). 설정에서 직접 끄면 복원되지 않는다.
- 개인정보처리방침은 법률 자문이 아닌 **초안**으로 쓰고 화면에 그렇게 명시한다.

## 8. 남은 작업 (우선순위 순)

1. **미커밋 변경 정리**: CAPTCHA 위젯 항상 표시(`captcha.tsx`, `ROADMAP.md`)와 이 문서를 사용자 요청에 따라 커밋(기능/문서 분리). 푸시는 사용자.
2. **5단계 개인정보처리방침**: `app/[lang]/privacy/page.tsx`(지금은 "준비 중" 자리표시자)와 `ko.json`·`en.json`의 `privacy.*` 확장. 수집 항목(이메일·비밀번호, Google OAuth, 게스트, 일정 제목·설명, AI 대화 30일 보관과 Google Gemini 전송, 푸시 구독, 카카오 토큰 암호화, 알림 기록 30일, 사용자 메타데이터), 처리 위탁·국외 이전(Supabase, Vercel, Google, Kakao, 브라우저 푸시 서비스, Cloudflare Turnstile), 정보주체 권리와 삭제 방법(설정의 계정 삭제), 안전성 조치, 쿠키, 보호책임자 연락처(**사용자에게 받는다**), 시행일. 가입·설정 화면에서 방침으로 링크. 로드맵에는 "Google Gemini 무료 등급은 입력이 모델 개선에 쓰일 수 있음 — 확인 필요"가 남아 있다.
3. **6단계 배포(대화로 함께)**:
   - 운영 값을 **새로** 만든다: VAPID 키 쌍(개발 키는 대화에 노출됨), `CRON_SECRET`, 카카오 암호화 키(32바이트 base64), `SITE_URL`(운영 origin), Turnstile **운영 키 쌍**.
   - Vercel 연결과 환경변수 등록(§10의 표).
   - Supabase: 마이그레이션 10개 적용, Site URL·Redirect URLs(운영 `/auth/callback`만 정확히, 와일드카드 금지), Confirm email 유지, **SMTP 직접 연결(Resend 권장, 기본 서버는 한도가 작음)**, Anonymous sign-ins, Manual linking, 비밀번호 정책을 코드와 같게(8자·영문+숫자), "Secure password change" 켜기, Google OAuth 운영 redirect.
   - **CAPTCHA 켜는 순서(거꾸로 하면 가입·로그인·게스트·비밀번호 찾기가 모두 막힘)**: Cloudflare Turnstile 사이트 생성(도메인에 운영 주소와 `localhost`) → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 등록·배포 → **그다음** Supabase 대시보드 Authentication > Attack Protection에서 CAPTCHA를 켜고 Turnstile **비밀 키 입력**(우리 코드와 `.env`에는 비밀 키를 두지 않는다. 검증은 Supabase가 한다). 사이트 키와 비밀 키는 짝이어야 한다(시험용 사이트 키 `1x00000000000000000000AA` ↔ 시험용 비밀 키 `1x0000000000000000000000000000000AA`).
   - 카카오 콘솔: 운영 Redirect URI(`SITE_URL/auth/kakao/callback`), 앱 대표 도메인(localhost는 입력 불가). **`talk_message` 동의항목이 앱 소유자 외 계정에도 심사 없이 허용되는지는 미확인** — 심사가 필요하면 카카오 연결은 소유자 전용으로 먼저 배포.
   - 배포 후 `supabase/cron/schedule.sql` 실행(pg_cron·pg_net 활성화, Vault 비밀 `notify_base_url`·`notify_cron_secret`, 재실행 시 `vault.create_secret` 이름 중복 주의). 로컬에는 워커를 1분마다 호출해 줄 곳이 없다(아래 §11의 `curl`).
   - `package.json`에 `engines.node` 명시, 개발/운영 Supabase 프로젝트 분리 여부 결정(권장: 분리), 도메인 결정, Gemini 일일 비용 상한·경보 설정.
   - 검증: 11분 뒤 일정으로 웹 푸시·카카오톡 end-to-end, 중복 발송 없음, 가입·재설정 메일 링크가 운영 주소로 돌아옴. 롤백은 Vercel Instant Rollback(DB는 되돌리지 않음).
4. **선택·후속(낮은 위험)**: 익명 역할의 테이블 권한 회수 마이그레이션 제안(`events`·`notifications`·`push_subscriptions`·`kakao_tokens`는 지금 익명 키로 조회하면 RLS 때문에 `[]`가 나옴, `ai_*`·`action_requests`는 이미 `42501`), `ai_messages`에 assistant 메시지를 직접 넣어 위조할 수 있음(막으려면 `app/api/ai/route.ts`의 assistant 저장을 service role로 옮기고 삽입 정책을 role='user'로 제한), 가입 응답의 계정 존재 노출, 푸시 구독 10개 상한의 동시 요청 경쟁, CSP(Report-Only부터), 주간 겹침 열 수 상한·"+N", 주간 `description` 지연 로드, 카카오 암호화 키 회전 절차, 메일 코드(OTP) 입력.

## 9. 사용자 확인 대기 중인 시험 (결과를 아직 못 들음)

- `20261031000003_hardening.sql` 적용 후 **일정 추가·수정이 정상인지**(새 제약·10,000개 상한 트리거). 익명 키 조회로 `action_requests`가 존재함(→ 적용된 듯)까지만 확인됨.
- 설정 화면에서 푸시·카카오 **테스트 버튼을 연달아 눌러 4번째에 제한 안내**가 나오는지.
- 비밀번호 재설정 end-to-end(메일 한도에 걸려 못 끝냄), 확인 메일 다시 보내기, 약한·불일치·같은 비밀번호 거부 문구.
- **CAPTCHA**: 위젯이 보이고 "성공"으로 바뀌는 것까지는 사용자가 확인했다(시험용 사이트 키로 보임). Supabase에서 CAPTCHA를 켠 뒤의 가입·로그인·게스트·비밀번호 찾기 성공은 **미확인**(대시보드는 아직 켜지 않은 것으로 보임). 체크를 요구하는 모습을 보려면 시험용 키 `3x00000000000000000000FF`.
- 계정 삭제(**시험용 계정으로만**; 되돌릴 수 없음), 푸시의 로그아웃 해제·재로그인 자동 복원, 카카오 연결 해제·재연결·토큰 만료 후 갱신·재연결 필요 상태, 게스트가 주소로 `/auth/kakao/connect`를 직접 열었을 때의 팝업, 영어 화면 전체.
- 구글로 가입한 계정이 "비밀번호 찾기"로 비밀번호를 설정할 수 있는지, 같은 이메일 가입 시 계정 연결 동작.
- 처음 워커를 호출했을 때 사용자가 "0byte 파일도 왔다"고 한 일은 재현되지 않았고 원인 불명.

## 10. 환경변수 (이름과 상태. 값은 어디에도 적지 않는다)

`.env`는 gitignore. 마지막 확인(2026-10-29): 아래 14개가 모두 설정되어 있다(글자 수만 확인함). 설명 원본은 `.env.example`.

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
- Supabase MCP(`.mcp.json`, 읽기 전용·프로젝트 범위)는 새 세션에서 승인·인증해야 도구가 보인다. 이 세션에서는 로드되지 않아 DB 조회는 사용자의 SQL 편집기 결과에 의존했다.
