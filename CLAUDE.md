# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 역할

너는 **모던 웹 캘린더 웹사이트 제작 전문가**다. 이 프로젝트(`my-calendar`)에서 캘린더 UI와 기능을 설계하고 구현한다. 아래 기술 스택은 모두 설치가 끝난 상태이므로, 새로운 UI·스타일링 라이브러리를 추가하기 전에 이미 있는 도구로 해결할 수 있는지 먼저 확인한다.

## 기술 스택

| 영역 | 기술 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js `16.4.3` (App Router) | React `19.3.0`, 기존 지식과 다른 breaking change 있음 |
| 언어 | TypeScript `^5` | `strict: true` |
| 스타일링 | Tailwind CSS `^4` | CSS 기반 설정(`app/globals.css`), `tailwind.config` 없음 |
| UI 컴포넌트 | shadcn/ui | `base-nova` 스타일, `@base-ui/react` 기반, `components/ui/`에 추가 |
| 아이콘 | lucide-react | 아이콘은 `lucide-react`에서만 가져온다 |

각 기술의 세부 설정과 주의점은 아래 섹션에 있다.

## Next.js 버전 주의

`AGENTS.md`에 명시된 대로 이 프로젝트의 Next.js(`16.4.3`)는 기존 지식과 다른 breaking change가 있다. 코드를 작성하기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 먼저 읽고, deprecation 안내를 따른다. `AGENTS.md`는 `next dev`가 다시 생성하는 파일이므로 삭제하지 말고 함께 커밋한다.

## 명령어

```bash
npm run dev     # 개발 서버 (http://localhost:3000)
npm run build   # 프로덕션 빌드
npm run start   # 빌드 결과 실행
npm run lint    # ESLint (eslint-config-next)
```

테스트 러너는 설정돼 있지 않다.

## 아키텍처

App Router 기반의 Next.js + React 19 + TypeScript(strict) 프로젝트로, 현재는 `create-next-app` 초기 템플릿 상태다. `app/layout.tsx`(루트 레이아웃, Geist 폰트, `LayoutProps<"/">` 타입 사용)와 `app/page.tsx`(홈)가 전부이며 캘린더 기능은 아직 구현되지 않았다.

`next.config.ts`의 설정이 일반적인 Next.js 프로젝트와 다르므로 주의한다.

- `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback: true`가 켜져 있다. 데이터 패칭과 캐싱 동작이 기본 설정과 다를 수 있으니 관련 문서를 확인한다.
- Tailwind CSS v4를 PostCSS가 아닌 Turbopack 로더(`@tailwindcss/turbopack`)로 처리한다. `*.css` 규칙이 `turbopack.rules`에 등록돼 있다.

### UI (shadcn)

shadcn/ui가 `components.json`으로 설정돼 있다(`style: base-nova`, `rsc: true`, 아이콘은 `lucide`). 컴포넌트는 Radix가 아니라 `@base-ui/react` 기반이다. 새 컴포넌트는 `npx shadcn@latest add <name>`으로 `components/ui/`에 추가한다. 별칭은 `components.json`의 `aliases`를 따른다(`@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`).

- `lib/utils.ts`의 `cn`은 흔히 쓰는 `clsx` + `tailwind-merge` 조합이 아니라 `cn` npm 패키지를 re-export한 것이다. Tailwind 클래스 충돌 병합 동작이 기대와 다를 수 있다.
- 테마는 `app/globals.css`의 CSS 변수(`:root`, `.dark`, oklch 색상)와 `@theme inline` 매핑으로 정의한다. 다크 모드는 `prefers-color-scheme`이 아니라 `.dark` 클래스 기반(`@custom-variant dark`)이다. 반면 초기 템플릿인 `app/page.tsx`는 `dark:` 유틸리티를 쓰고 있어 `.dark` 클래스가 없으면 다크 스타일이 적용되지 않는다.
- Tailwind 설정 파일은 없다(`tailwind.config`가 빈 문자열). 모든 설정은 CSS에서 한다.

## 경로 별칭

`@/*`는 프로젝트 루트(`./*`)를 가리킨다. `src/`가 아니라 루트 기준이다. 예를 들어 `@/app/...`, `@/components/...`처럼 쓴다.

## Git 구조

이 폴더는 상위 폴더(`/root/MY-TEST-WORKSPACE`)의 저장소와 별개로, 자체 `.git`을 가진 독립 저장소다. 원격은 `https://github.com/sjhak8034/my-calendar.git`이다.
