# my-calendar

월간 캘린더에서 일정을 관리하고, 선택한 날짜 범위의 일정에 대해 AI와 대화하며 확인하고, 일정 시작 전·종료 시 알림(웹 푸시, 카카오톡)을 받는 개인용 캘린더입니다. 이후 다중 사용자 서비스로 확장할 수 있도록 데이터는 사용자 단위로 분리합니다.

## 기술 스택

- Next.js `16.4.3` (App Router), React `19.3.0`, TypeScript (strict)
- Tailwind CSS v4, shadcn/ui (`base-nova`), lucide-react
- 도입 예정: Supabase(Auth·DB), Gemini API(Google AI Studio), Vercel 배포

## 시작하기

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드
npm run lint    # ESLint
```

## 문서

- 요구사항: [`docs/PRD.md`](docs/PRD.md)
- 개발 계획: [`docs/ROADMAP.md`](docs/ROADMAP.md)
