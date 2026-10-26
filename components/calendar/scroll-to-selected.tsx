"use client";

import { useEffect, useRef, type ComponentProps } from "react";

type Props = ComponentProps<"div"> & {
  selectedDate: string; // 선택한 날짜(YYYY-MM-DD): 바뀔 때마다 가로 위치를 보정
  weekStart: string; // 보고 있는 주의 시작일: 주가 바뀔 때만 세로 위치를 보정
};

// 가로·세로 스크롤 컨테이너. 컨테이너 안의 scrollLeft/scrollTop만 조정한다(페이지 스크롤은 건드리지 않음).
// - 선택한 날짜 열(헤더의 [data-selected])이 고정된 시간 눈금 열 오른쪽에서 보이게 한다(날짜가 바뀔 때마다).
// - 현재 시각 줄이 있고 보이는 범위 밖이면 세로 가운데로 가져온다(마운트와 주가 바뀔 때만).
// - 위에 붙는 영역(sticky) 높이를 scroll-padding-top에 반영해, 포커스된 요소가 그 뒤에 가려지지 않게 한다.
export function ScrollToSelected({ selectedDate, weekStart, ...divProps }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;
    const target = container.querySelector<HTMLElement>(
      '[data-slot="week-header-cell"][data-selected]',
    );
    if (!target) return;
    const gutter =
      container.querySelector<HTMLElement>('[data-slot="time-gutter"]')?.offsetWidth ?? 0;
    const box = container.getBoundingClientRect();
    const cell = target.getBoundingClientRect();
    const visibleLeft = box.left + gutter;
    if (cell.left < visibleLeft || cell.right > box.right) {
      container.scrollLeft += cell.left - visibleLeft;
    }
  }, [selectedDate]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const nowLine = container.querySelector<HTMLElement>('[data-slot="now-line"]');
    if (!nowLine || container.scrollHeight <= container.clientHeight) return;
    const stickyHeight =
      container.querySelector<HTMLElement>('[data-slot="week-sticky"]')?.offsetHeight ?? 0;
    const box = container.getBoundingClientRect();
    const line = nowLine.getBoundingClientRect();
    const visibleTop = box.top + stickyHeight;
    if (line.top < visibleTop + 16 || line.bottom > box.bottom - 16) {
      container.scrollTop += line.top - (visibleTop + (box.bottom - visibleTop) / 2);
    }
  }, [weekStart]);

  useEffect(() => {
    const container = ref.current;
    const sticky = container?.querySelector<HTMLElement>('[data-slot="week-sticky"]');
    if (!container || !sticky) return;
    const apply = () => {
      container.style.scrollPaddingTop = `${sticky.offsetHeight}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(sticky);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} data-slot="week-scroll" {...divProps} />;
}
