import { notFound } from "next/navigation";

// 어디에도 맞지 않는 주소(/ko/아무거나)와 proxy.ts가 돌려보낸 잘못된 날짜 경로를 404 화면과 404 상태로 처리한다.
// 루트 레이아웃이 [lang]이라 이 페이지가 없으면 Next.js 기본 404 화면이 나온다.
export default function NotFoundPage() {
  notFound();
}
