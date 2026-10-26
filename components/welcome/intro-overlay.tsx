"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// 로그인 직후 환영 페이지(/[lang]/welcome)에 오면 화면을 덮는 인트로.
// 언어 레이아웃에 있어 페이지가 바뀌어도 유지되므로, 인트로가 도는 동안 뒤에서 캘린더로 이동해 렌더링·데이터 로딩을 끝낸다.
// public/Welcome.svg의 손글씨는 SMIL로 스스로 써지며(약 0.2~3.25초), 이미지가 마운트될 때 시작한다.
const INTRO_SRC = "/Welcome.svg";
const AUTO_MS = 3900; // 글씨가 다 써지는 시점(약 3.25초) + 잠깐 머무름
const LEAVE_MS = 450; // 사라지는 시간
const ARM_MS = 700; // 이 시간 전에는 키·화면 클릭으로 건너뛰지 않는다(로그인 때 누른 Enter가 이어지는 경우 방지)

// idle → playing → leaving → (환영 페이지에 아직 있으면 done) → idle
type Phase = "idle" | "playing" | "leaving" | "done";

// 인트로 뒤에서 이동할 곳. next는 콜백에서 이미 걸렀지만 주소를 직접 입력하는 경우에 대비해 같은 출처의 경로만 허용한다.
function destination(lang: string, next: string | null): string {
  const fallback = `/${lang}`;
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    const path = url.pathname + url.search;
    if (path.startsWith("//") || url.pathname.startsWith(`/${lang}/welcome`)) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

type Props = {
  lang: string;
  title: string; // 보조기기용 제목
  skipLabel: string;
};

export function IntroOverlay({ lang, title, skipLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onWelcome = pathname === `/${lang}/welcome`;
  const [phase, setPhase] = useState<Phase>("idle");
  const armedAt = useRef(0);

  // 환영 페이지에 들어온 렌더에서 바로 시작해 첫 커밋부터 덮는다. 환영 페이지를 벗어난 뒤에야 다음 로그인을 위해 초기화한다.
  if (onWelcome && phase === "idle") setPhase("playing");
  if (!onWelcome && phase === "done") setPhase("idle");
  const active = phase === "playing" || phase === "leaving";

  // 인트로 뒤에서 캘린더로 이동한다(기록은 대체해 뒤로 가기로 환영 페이지에 돌아오지 않게).
  useEffect(() => {
    if (!onWelcome) return;
    router.replace(destination(lang, searchParams.get("next")), { scroll: false });
  }, [onWelcome, lang, router, searchParams]);

  // 인트로가 떠 있는 동안 뒤의 화면은 조작·탐색에서 제외한다.
  useLayoutEffect(() => {
    if (!active) return;
    const root = document.querySelector<HTMLElement>('[data-slot="page-root"]');
    root?.setAttribute("inert", "");
    return () => root?.removeAttribute("inert");
  }, [active]);

  const leave = useCallback(() => {
    setPhase((current) => (current === "playing" ? "leaving" : current));
  }, []);

  // 자동 이동: 쓰기가 끝나고 잠시 뒤 사라진다.
  useEffect(() => {
    if (phase !== "playing") return;
    armedAt.current = performance.now() + ARM_MS;
    const timer = window.setTimeout(leave, AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [phase, leave]);

  // 사라지는 전환이 끝나면 내린다.
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("done"), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // 화면 클릭·키로 건너뛰기는 잠깐 뒤부터(건너뛰기 버튼은 바로 동작)
  const leaveIfArmed = useCallback(() => {
    if (performance.now() >= armedAt.current) leave();
  }, [leave]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        leaveIfArmed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, leaveIfArmed]);

  if (!active) return null;

  return (
    <div
      role="status"
      data-slot="intro-overlay"
      onClick={leaveIfArmed}
      className={
        "fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-background text-foreground " +
        "transition-opacity ease-out motion-reduce:transition-none " +
        (phase === "leaving" ? "opacity-0 duration-[450ms]" : "opacity-100 duration-200")
      }
    >
      <h1 className="sr-only">{title}</h1>
      {/* 이미지가 마운트될 때 SMIL 타임라인이 처음부터 시작한다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={INTRO_SRC}
        alt=""
        draggable={false}
        className="aspect-[428/123] w-[min(82vw,40rem)] select-none"
      />
      <Button
        type="button"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation();
          leave();
        }}
        className="absolute right-5 bottom-5 text-muted-foreground sm:right-8 sm:bottom-8"
      >
        {skipLabel}
      </Button>
    </div>
  );
}
