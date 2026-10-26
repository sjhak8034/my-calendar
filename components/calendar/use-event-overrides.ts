"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { EventFormLabels } from "@/components/calendar/event-form";
import {
  fromDayRange,
  toDayRange,
  type DayRange,
} from "@/lib/calendar";
import { deleteEvent, moveEvent } from "@/lib/events/actions";
import { fromEvent, type EditableEvent } from "@/lib/events/input";

// 낙관적 업데이트: 저장이 끝나기 전에 화면에 먼저 적용하는 새 위치.
// seq는 같은 일정을 연달아 옮길 때 최신 덮어쓰기만 지키기 위한 번호다.
export type Override = { range: DayRange; seq: number };

const STALE_OVERRIDE_MS = 5000; // 서버 데이터가 도착하지 않아도(주 이동 등) 이 시간 뒤에는 덮어쓰기를 걷는다

type Options = {
  labels: EventFormLabels;
  onSubmit: () => void; // 저장을 시작할 때(이전 오류 알림 지우기)
  onSaved: (eventId: string, fields: ReturnType<typeof fromDayRange>) => void; // 사이드바 시각 입력 동기화
  onError: (message: string) => void;
};

// 놓은 새 위치를 일정 데이터에 즉시 덮어쓰고 뒤에서 저장한다. 실패하면 덮어쓰기를 걷어 원래 자리로 돌린다.
// `startTransition`은 유지한다(없으면 재검증으로 페이지가 갱신될 때 Suspense 스켈레톤이 보일 수 있다).
export function useEventOverrides({ labels, onSubmit, onSaved, onError }: Options) {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  // 낙관적 삭제: 서버에서 지워지기 전에 목록에서 먼저 숨긴 일정(id → 번호)
  const [removed, setRemoved] = useState<Record<string, number>>({});
  const [, startSaving] = useTransition();
  const seqRef = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const ids = timers.current;
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  const dropOverride = useCallback((eventId: string, seq?: number) => {
    setOverrides((prev) => {
      const current = prev[eventId];
      if (!current || (seq !== undefined && current.seq !== seq)) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }, []);

  // 서버 데이터가 덮어쓴 위치와 같아졌다면(저장 반영 완료) 덮어쓰기를 걷는다.
  const reconcile = useCallback((serverEvents: readonly EditableEvent[]) => {
    // 서버 목록에서 사라진 일정은 낙관적 삭제 표시를 걷는다.
    setRemoved((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      const present = new Set(serverEvents.map((event) => event.id));
      const gone = ids.filter((id) => !present.has(id));
      if (gone.length === 0) return prev;
      const next = { ...prev };
      for (const id of gone) delete next[id];
      return next;
    });
    setOverrides((prev) => {
      let next = prev;
      for (const event of serverEvents) {
        const override = prev[event.id];
        if (!override) continue;
        const range = toDayRange(fromEvent(event));
        if (
          range &&
          range.date === override.range.date &&
          range.startMin === override.range.startMin &&
          range.endMin === override.range.endMin
        ) {
          if (next === prev) next = { ...prev };
          delete next[event.id];
        }
      }
      return next;
    });
  }, []);

  const commitEvent = useCallback(
    (event: EditableEvent, range: DayRange) => {
      const fields = fromDayRange(range);
      const seq = ++seqRef.current;
      onSubmit();
      setOverrides((prev) => ({ ...prev, [event.id]: { range, seq } }));
      startSaving(async () => {
        let failure: string | null = null;
        try {
          // 시각만 갱신한다(제목·설명 등은 건드리지 않아 다른 탭의 수정을 덮어쓰지 않는다).
          const result = await moveEvent(event.id, range);
          if (!result.ok) {
            failure = result.code === "unauthorized" ? labels.errors.unauthorized : labels.moveFailed;
          }
        } catch {
          // 네트워크 단절·서버 오류로 Action 자체가 실패한 경우
          failure = labels.moveFailed;
        }
        if (failure === null) {
          onSaved(event.id, fields);
          timers.current.push(
            window.setTimeout(() => dropOverride(event.id, seq), STALE_OVERRIDE_MS),
          );
        } else {
          onError(failure);
          dropOverride(event.id, seq);
        }
      });
    },
    [labels, onSubmit, onSaved, onError, dropOverride],
  );

  // 일정을 목록에서 즉시 숨기고 뒤에서 삭제한다. 실패하면 다시 보이게 하고 알린다.
  const removeEvent = useCallback(
    (event: EditableEvent) => {
      const seq = ++seqRef.current;
      onSubmit();
      setRemoved((prev) => ({ ...prev, [event.id]: seq }));
      dropOverride(event.id);
      const restore = () =>
        setRemoved((prev) => {
          if (prev[event.id] !== seq) return prev;
          const next = { ...prev };
          delete next[event.id];
          return next;
        });
      startSaving(async () => {
        let failure: string | null = null;
        try {
          const result = await deleteEvent(event.id);
          // 이미 지워진 일정(notFound)은 원하는 결과와 같으므로 실패로 보지 않는다.
          if (!result.ok && result.code !== "notFound") {
            failure =
              result.code === "unauthorized" ? labels.errors.unauthorized : labels.deleteFailed;
          }
        } catch {
          failure = labels.deleteFailed;
        }
        if (failure === null) {
          timers.current.push(window.setTimeout(restore, STALE_OVERRIDE_MS));
        } else {
          onError(failure);
          restore();
        }
      });
    },
    [labels, onSubmit, onError, dropOverride],
  );

  return { overrides, removed, reconcile, commitEvent, removeEvent };
}
