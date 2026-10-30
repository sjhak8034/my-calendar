"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchCandidates, type PlaceCandidate } from "@/components/calendar/event-map";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (candidate: PlaceCandidate) => void; // 후보를 골랐을 때(좌표를 함께 받는다)
  listLabel: string;
  placeholder: string;
  maxLength: number;
  invalid?: boolean;
  describedBy?: string;
};

// 장소 입력칸 + 카카오 검색 후보 드롭다운. 키가 없거나 검색이 실패하면 후보 없이 일반 입력칸으로 동작한다.
export function PlaceInput({
  id,
  value,
  onChange,
  onPick,
  listLabel,
  placeholder,
  maxLength,
  invalid,
  describedBy,
}: Props) {
  const listId = useId();
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // 후보를 골라 값이 바뀐 직후에는 그 값으로 다시 검색하지 않는다.
  const skip = useRef<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    if (!query || skip.current === query) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await searchCandidates(query);
        if (cancelled) return;
        setCandidates(found);
        setActive(-1);
        setOpen(found.length > 0);
      } catch {
        if (!cancelled) setCandidates([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  function pick(candidate: PlaceCandidate) {
    const text = candidate.address ? `${candidate.label} (${candidate.address})` : candidate.label;
    skip.current = text.trim();
    onChange(text);
    onPick(candidate);
    setOpen(false);
    setCandidates([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? candidates.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // 폼 제출 대신 후보를 고른다.
      pick(candidates[active]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => {
          skip.current = null;
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => candidates.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {candidates.map((c, i) => (
            <li
              key={`${c.x}-${c.y}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown에서 막아야 입력칸이 포커스를 잃어(blur) 목록이 닫히기 전에 선택이 처리된다.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                i === active && "bg-accent text-accent-foreground",
              )}
            >
              <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.label}</span>
                {c.address && (
                  <span className="block truncate text-xs text-muted-foreground">{c.address}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
