import { getWeekdayNames, type CalendarDate, type MonthGrid as Grid } from "@/lib/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { WeekData } from "@/lib/events/month-layout";
import type { HolidayMap } from "@/lib/holidays/ics";
import type { NoteMap } from "@/lib/notes/input";
import type { DayNoteLabels } from "./day-note";
import { WeekRow } from "./week-row";

type Props = {
  lang: Locale;
  grid: Grid;
  weeks: WeekData[];
  today: CalendarDate;
  dict: Dictionary["calendar"];
  holidays: HolidayMap;
  notes: NoteMap;
  noteLabels: DayNoteLabels;
};

// 요일 헤더 + 6주
export function MonthGrid({ lang, grid, weeks, today, dict, holidays, notes, noteLabels }: Props) {
  const weekdays = getWeekdayNames(lang);

  return (
    <div
      role="grid"
      aria-label={dict.monthGridLabel}
      data-slot="month-grid"
      className="overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <div role="row" className="grid grid-cols-7 border-b bg-card">
        {weekdays.map((name) => (
          <div
            key={name}
            role="columnheader"
            className="border-r py-2.5 text-center text-xs font-medium text-muted-foreground last:border-r-0"
          >
            {name}
          </div>
        ))}
      </div>
      {grid.map((days, i) => (
        <WeekRow
          key={days[0].date}
          lang={lang}
          days={days}
          today={today}
          data={weeks[i]}
          dict={dict}
          holidays={holidays}
          notes={notes}
          noteLabels={noteLabels}
        />
      ))}
    </div>
  );
}
