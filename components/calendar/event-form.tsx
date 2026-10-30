"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink } from "lucide-react";
import { DOT_CLASS } from "@/components/calendar/event-colors";
import { EventMap } from "@/components/calendar/event-map";
import { EVENT_COLORS, type EventColor } from "@/lib/calendar";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  type ActionResult,
} from "@/lib/events/actions";
import {
  ALL_DAY_END_TIME,
  ALL_DAY_START_TIME,
  DESCRIPTION_INPUT_LIMIT,
  LOCATION_INPUT_LIMIT,
  URL_INPUT_LIMIT,
  normalizeUrl,
  TITLE_INPUT_LIMIT,
  toPayload,
  type EventErrorCode,
  type EventErrors,
  type EventInput,
} from "@/lib/events/input";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

export type EventFormLabels = Dictionary["eventForm"];

type Props = {
  mode: "create" | "edit";
  eventId?: string;
  values: EventInput; // 제어 값: 사이드바와 그리드의 초안 블록이 함께 쓴다
  onChange: (patch: Partial<EventInput>) => void;
  labels: EventFormLabels;
  onDone: () => void; // 저장·삭제 성공 후
  onCancel: () => void;
};

type FormError = EventErrorCode | "unauthorized" | "notFound" | "failed" | "validation";

// 사이드바 안의 일정 입력 폼(생성·수정). 값은 위에서 내려받고, 저장 성공 시 서버가 화면을 다시 그린다.
export function EventForm({
  mode,
  eventId,
  values,
  onChange,
  labels,
  onDone,
  onCancel,
}: Props) {
  const uid = useId();
  const [errors, setErrors] = useState<EventErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  // 삭제 확인으로 바뀌면 "취소"로, 취소해 돌아오면 "삭제"로 포커스를 옮겨 키보드 위치를 잃지 않게 한다.
  useEffect(() => {
    if (confirmingDelete) cancelDeleteRef.current?.focus();
    else if (wasConfirming.current) deleteRef.current?.focus();
    wasConfirming.current = confirmingDelete;
  }, [confirmingDelete]);
  const [pending, startTransition] = useTransition();

  const id = (name: string) => `${uid}-${name}`;
  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) =>
    onChange({ [key]: value } as Partial<EventInput>);
  const message = (code: FormError) => labels.errors[code];

  function setStartDate(value: string) {
    // 종료일이 시작일보다 앞서지 않도록 따라 움직인다.
    onChange({
      startDate: value,
      ...(values.endDate && value && values.endDate < value ? { endDate: value } : {}),
    });
  }

  function setAllDay(checked: boolean) {
    onChange({
      allDay: checked,
      ...(checked ? { startTime: ALL_DAY_START_TIME, endTime: ALL_DAY_END_TIME } : {}),
    });
  }

  function handleResult(result: ActionResult) {
    if (result.ok) {
      onDone();
      return;
    }
    if (result.code === "validation" && result.errors) {
      setErrors(result.errors);
      return;
    }
    setFormError(result.code);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    // 빠른 피드백용 클라이언트 검증. 서버가 같은 검증을 다시 한다.
    const parsed = toPayload(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        handleResult(
          mode === "edit" && eventId
            ? await updateEvent(eventId, values)
            : await createEvent(values),
        );
      } catch {
        // 네트워크 단절·서버 오류로 Action 자체가 실패한 경우
        setFormError("failed");
      }
    });
  }

  function handleDelete() {
    if (!eventId) return;
    setFormError(null);
    startTransition(async () => {
      try {
        handleResult(await deleteEvent(eventId));
      } catch {
        setFormError("failed");
      }
    });
  }

  // 새 종일 일정(월간에서 만듦)은 시각이 없어서 시각 입력을 숨긴다. 수정에서는 기존처럼 항상 보인다.
  const showTimes = !(mode === "create" && values.allDay);

  // 화면에는 http(s)로 확인된 링크만 그린다(javascript: 등 차단).
  const safeUrl = normalizeUrl(values.url);

  const err = (field: keyof EventErrors) => {
    const code = errors[field];
    return code ? message(code) : null;
  };

  return (
    <form
      data-slot="event-form"
      noValidate
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <Field label={labels.title} htmlFor={id("title")} error={err("title")} errorId={id("title-error")}>
          <Input
            id={id("title")}
            autoFocus
            value={values.title}
            maxLength={TITLE_INPUT_LIMIT}
            placeholder={labels.titlePlaceholder}
            autoComplete="off"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? id("title-error") : undefined}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>

        {/* 새 일정에는 종일 스위치를 두지 않는다: 주간에서 만들면 시간 일정, 월간에서 만들면 종일 일정(시각 없음)으로 정해진다. 기존 일정 수정에서는 바꿀 수 있다. */}
        {mode === "edit" && (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={id("all-day")}>{labels.allDay}</Label>
            <Switch
              id={id("all-day")}
              checked={values.allDay}
              onCheckedChange={setAllDay}
            />
          </div>
        )}

        <div
          className={cn(
            "grid gap-x-3 gap-y-4",
            showTimes ? "grid-cols-[minmax(0,1fr)_minmax(0,8rem)]" : "grid-cols-2",
          )}
        >
          <Field label={labels.startDate} htmlFor={id("start-date")}>
            <Input
              id={id("start-date")}
              type="date"
              value={values.startDate}
              aria-invalid={!!errors.start}
              aria-describedby={errors.start ? id("start-error") : undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          {showTimes && (
          <Field label={labels.startTime} htmlFor={id("start-time")}>
            <Input
              id={id("start-time")}
              type="time"
              value={values.startTime}
              aria-invalid={!!errors.start}
              aria-describedby={errors.start ? id("start-error") : undefined}
              onChange={(e) => set("startTime", e.target.value)}
            />
          </Field>
          )}
          {errors.start && (
            <FieldError id={id("start-error")} className="col-span-2 -mt-2">
              {err("start")}
            </FieldError>
          )}
          <Field label={labels.endDate} htmlFor={id("end-date")}>
            <Input
              id={id("end-date")}
              type="date"
              value={values.endDate}
              min={values.startDate || undefined}
              aria-invalid={!!errors.end}
              aria-describedby={errors.end ? id("end-error") : undefined}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>
          {showTimes && (
          <Field label={labels.endTime} htmlFor={id("end-time")}>
            <Input
              id={id("end-time")}
              type="time"
              value={values.endTime}
              aria-invalid={!!errors.end}
              aria-describedby={errors.end ? id("end-error") : undefined}
              onChange={(e) => set("endTime", e.target.value)}
            />
          </Field>
          )}
          {errors.end && (
            <FieldError id={id("end-error")} className="col-span-2 -mt-2">
              {err("end")}
            </FieldError>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm leading-none font-medium">{labels.color}</legend>
          <div className="flex flex-wrap gap-2">
            {EVENT_COLORS.map((color) => (
              <ColorOption
                key={color}
                name={id("color")}
                color={color}
                label={labels.colors[color]}
                checked={values.color === color}
                onSelect={() => set("color", color)}
              />
            ))}
          </div>
          {errors.color && <FieldError>{err("color")}</FieldError>}
        </fieldset>

        <Field
          label={labels.location}
          htmlFor={id("location")}
          error={err("location")}
          errorId={id("location-error")}
        >
          <Input
            id={id("location")}
            value={values.location}
            maxLength={LOCATION_INPUT_LIMIT}
            placeholder={labels.locationPlaceholder}
            autoComplete="off"
            aria-invalid={!!errors.location}
            aria-describedby={errors.location ? id("location-error") : undefined}
            onChange={(e) => set("location", e.target.value)}
          />
        </Field>
        {values.location.trim() && (
          <EventMap query={values.location.trim()} labels={labels} />
        )}

        <Field
          label={labels.url}
          htmlFor={id("url")}
          error={err("url")}
          errorId={id("url-error")}
        >
          <Input
            id={id("url")}
            type="url"
            inputMode="url"
            value={values.url}
            maxLength={URL_INPUT_LIMIT}
            placeholder={labels.urlPlaceholder}
            autoComplete="off"
            aria-invalid={!!errors.url}
            aria-describedby={errors.url ? id("url-error") : undefined}
            onChange={(e) => set("url", e.target.value)}
          />
        </Field>
        {safeUrl && (
          <a
            href={safeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="-mt-2 inline-flex items-center gap-1 self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <ExternalLink aria-hidden="true" className="size-3" />
            {labels.openLink}
          </a>
        )}

        <Field
          label={labels.description}
          htmlFor={id("description")}
          error={err("description")}
          errorId={id("description-error")}
        >
          <Textarea
            id={id("description")}
            value={values.description}
            rows={4}
            maxLength={DESCRIPTION_INPUT_LIMIT}
            placeholder={labels.descriptionPlaceholder}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? id("description-error") : undefined}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        {formError && <FieldError>{message(formError)}</FieldError>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {confirmingDelete ? (
            <>
              <p role="alert" className="min-w-0 flex-1 basis-full text-sm text-destructive sm:basis-auto">
                {labels.deleteConfirm}
              </p>
              <div className="flex gap-2">
                <Button
                  ref={cancelDeleteRef}
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(false)}
                >
                  {labels.cancel}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={handleDelete}
                >
                  {pending ? labels.deleting : labels.deleteConfirmYes}
                </Button>
              </div>
            </>
          ) : (
            <>
              {mode === "edit" ? (
                <Button
                  ref={deleteRef}
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                >
                  {labels.delete}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                  {labels.cancel}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? labels.saving : labels.save}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

function FieldError({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p id={id} role="alert" className={cn("text-sm text-destructive", className)}>
      {children}
    </p>
  );
}

function ColorOption({
  name,
  color,
  label,
  checked,
  onSelect,
}: {
  name: string;
  color: EventColor;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="relative cursor-pointer">
      <input
        type="radio"
        name={name}
        value={color}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        title={label}
        className={cn(
          "block size-7 rounded-full ring-offset-2 ring-offset-popover transition-shadow peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          DOT_CLASS[color],
        )}
      />
    </label>
  );
}
