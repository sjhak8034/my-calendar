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
type KakaoResult = {
  x: string;
  y: string;
  place_name?: string; // 키워드 검색 결과에만 있다.
  address_name?: string;
  road_address_name?: string; // 키워드 검색 결과의 도로명 주소
  road_address?: { address_name: string } | null; // 주소 검색 결과의 도로명 주소
  address?: { address_name: string } | null; // 주소 검색 결과의 지번 주소
};
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const SDK_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

let sdkPromise: Promise<KakaoMaps> | null = null;

// SDK는 지도가 처음 필요할 때 한 번만 내려받는다(일정을 열지 않는 화면에는 외부 요청이 없다).
export function loadKakao(): Promise<KakaoMaps> {
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

export function search(maps: KakaoMaps, query: string): Promise<KakaoResult | null> {
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

// address·road·jibun은 주소 정보(address는 화면 표시용). 장소 이름이 있는 후보는 이름만 저장한다(이름에 주소를 덧붙이면 지도에서 다시 찾지 못한다).
export type PlaceCandidate = { label: string; address: string; road: string; jibun: string; x: number; y: number };

// 후보를 골랐을 때 입력칸에 저장할 글자: 가게·건물 이름 후보는 이름만, 주소 후보는 지번 주소(없으면 도로명).
export function pickedLocationText(c: PlaceCandidate): string {
  // address는 이름 후보일 때만 채워진다(주소 후보는 label이 곧 주소).
  if (c.address) return c.label.trim();
  return (c.jibun || c.road || c.label).trim();
}

// 입력 중 보여 줄 후보. 가게·건물 이름 검색을 먼저 하고, 결과가 없으면 주소 검색으로 찾는다.
export async function searchCandidates(query: string, max = 5): Promise<PlaceCandidate[]> {
  const maps = await loadKakao();
  const { Status, Geocoder, Places } = maps.services;
  const toCandidate = (r: KakaoResult): PlaceCandidate => {
    const address = r.road_address_name || r.address_name || "";
    return {
      label: r.place_name || address,
      address: r.place_name ? address : "",
      road: r.road_address_name || r.road_address?.address_name || "",
      jibun: r.address?.address_name || (r.place_name ? r.address_name || "" : ""),
      x: Number(r.x),
      y: Number(r.y),
    };
  };
  const places = await new Promise<KakaoResult[]>((resolve) =>
    new Places().keywordSearch(query, (r, status) => resolve(status === Status.OK ? r : [])),
  );
  if (places.length > 0) return places.slice(0, max).map(toCandidate);
  const addresses = await new Promise<KakaoResult[]>((resolve) =>
    new Geocoder().addressSearch(query, (r, status) => resolve(status === Status.OK ? r : [])),
  );
  return addresses.slice(0, max).map(toCandidate);
}

type State = "loading" | "ready" | "notFound" | "failed";

export function kakaoMapLink(query: string) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}

// 일정 장소를 작은 지도로 보여 준다. 키가 없거나 SDK·검색이 실패해도 "카카오맵에서 보기" 링크는 항상 남긴다.
export function EventMap({
  query,
  coords,
  labels,
}: {
  query: string;
  coords?: { x: number; y: number }; // 후보에서 고른 장소는 좌표를 알고 있어 다시 검색하지 않는다.
  labels: EventMapLabels;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    // 입력 중에 검색이 쏟아지지 않도록 잠깐 기다린다.
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        const maps = await loadKakao();
        const found = coords ? { x: String(coords.x), y: String(coords.y) } : await search(maps, query);
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
  }, [query, coords]);

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
