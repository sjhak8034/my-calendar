"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

export type EventMapLabels = {
  mapNotFound: string;
  mapLoadFailed: string;
  openInKakaoMap: string;
};

// 카카오맵 JS SDK에서 쓰는 부분만 적은 최소 타입(공식 타입 패키지를 추가하지 않는다).
type KakaoLatLng = unknown;
type KakaoMaps = {
  load: (cb: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => {
    setCenter: (p: KakaoLatLng) => void;
  };
  Marker: new (opts: { map: unknown; position: KakaoLatLng }) => unknown;
  services: {
    Status: { OK: string };
    Geocoder: new () => {
      addressSearch: (q: string, cb: (r: KakaoResult[], s: string) => void) => void;
    };
    Places: new () => {
      keywordSearch: (q: string, cb: (r: KakaoResult[], s: string) => void) => void;
    };
  };
};
type KakaoResult = { x: string; y: string };
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const SDK_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

let sdkPromise: Promise<KakaoMaps> | null = null;

// SDK는 지도가 처음 필요할 때 한 번만 내려받는다(일정을 열지 않는 화면에는 외부 요청이 없다).
function loadKakao(): Promise<KakaoMaps> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<KakaoMaps>((resolve, reject) => {
    if (!SDK_KEY) {
      reject(new Error("no-key"));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(SDK_KEY)}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) reject(new Error("no-sdk"));
      else maps.load(() => resolve(maps));
    };
    script.onerror = () => reject(new Error("load-failed"));
    document.head.appendChild(script);
  }).catch((e) => {
    sdkPromise = null; // 다음에 다시 시도할 수 있게 한다.
    throw e;
  });
  return sdkPromise;
}

function search(maps: KakaoMaps, query: string): Promise<KakaoResult | null> {
  const { Status, Geocoder, Places } = maps.services;
  return new Promise((resolve) => {
    // 도로명·지번 주소로 먼저 찾고, 못 찾으면 가게·건물 이름으로 찾는다.
    new Geocoder().addressSearch(query, (r, status) => {
      if (status === Status.OK && r.length > 0) return resolve(r[0]);
      new Places().keywordSearch(query, (p, s) =>
        resolve(s === Status.OK && p.length > 0 ? p[0] : null),
      );
    });
  });
}

type State = "loading" | "ready" | "notFound" | "failed";

export function kakaoMapLink(query: string) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}

// 일정 장소를 작은 지도로 보여 준다. 키가 없거나 SDK·검색이 실패해도 "카카오맵에서 보기" 링크는 항상 남긴다.
export function EventMap({ query, labels }: { query: string; labels: EventMapLabels }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    // 입력 중에 검색이 쏟아지지 않도록 잠깐 기다린다.
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        const maps = await loadKakao();
        const found = await search(maps, query);
        if (cancelled) return;
        if (!found || !box.current) {
          setState("notFound");
          return;
        }
        const position = new maps.LatLng(Number(found.y), Number(found.x));
        const map = new maps.Map(box.current, { center: position, level: 3 });
        new maps.Marker({ map, position });
        setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* 결과가 없을 때도 지도 상자는 유지해(숨기지 않고 겹쳐 안내) 다시 찾았을 때 같은 요소에 그린다. */}
      <div className="relative h-40 overflow-hidden rounded-lg border bg-muted">
        <div ref={box} className="absolute inset-0" />
        {state !== "ready" && (
          <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
            {state === "notFound"
              ? labels.mapNotFound
              : state === "failed"
                ? labels.mapLoadFailed
                : ""}
          </p>
        )}
      </div>
      <a
        href={kakaoMapLink(query)}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        <ExternalLink aria-hidden="true" className="size-3" />
        {labels.openInKakaoMap}
      </a>
    </div>
  );
}
