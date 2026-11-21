export const TIME_ZONE = "Asia/Jakarta";

export const DAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
export const DAY_SHORT_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type ScheduleEntry = {
  id: string;
  dayOfWeek: number;
  subject: string;
  startPeriod: number;
  endPeriod: number;
  room: string | null;
  teacher: string | null;
  notes?: string;
  tasks?: ScheduleTask[];
};

export type ScheduleTask = {
  id: string;
  text: string;
  done: boolean;
};

export type ScheduleProfile = {
  id: string;
  name: string;
  entries: ScheduleEntry[];
};

export type ScheduleSnapshot = {
  revision: number;
  profiles: ScheduleProfile[];
};

export type ScheduleDraft = {
  dayOfWeek: number;
  subject: string;
  startPeriod: number;
  endPeriod: number;
  room: string;
  teacher: string;
};

type SchoolDayPeriods = {
  firstPeriodStartMinute: number;
  minutesPerPeriod: number;
  breaksAfterPeriod: Record<number, number>;
};

const SCHOOL_DAY_PERIODS: Partial<Record<number, SchoolDayPeriods>> = {
  // Senin mengikuti tabel Selasa–Kamis yang dikonfirmasi pengguna.
  1: { firstPeriodStartMinute: 6 * 60 + 30, minutesPerPeriod: 45, breaksAfterPeriod: { 4: 15, 8: 45 } },
  2: { firstPeriodStartMinute: 6 * 60 + 30, minutesPerPeriod: 45, breaksAfterPeriod: { 4: 15, 8: 45 } },
  3: { firstPeriodStartMinute: 6 * 60 + 30, minutesPerPeriod: 45, breaksAfterPeriod: { 4: 15, 8: 45 } },
  4: { firstPeriodStartMinute: 6 * 60 + 30, minutesPerPeriod: 45, breaksAfterPeriod: { 4: 15, 8: 45 } },
  // Jumat memakai 40 menit per JP dan istirahat 15 menit setelah JP4.
  5: { firstPeriodStartMinute: 6 * 60 + 30, minutesPerPeriod: 40, breaksAfterPeriod: { 4: 15 } }
};

export type LessonTiming = {
  durationMinutes: number;
  endTime: string | null;
};

export function getLessonTiming(entry: Pick<ScheduleEntry, "dayOfWeek" | "startPeriod" | "endPeriod">): LessonTiming {
  const periodCount = entry.endPeriod - entry.startPeriod + 1;
  const day = SCHOOL_DAY_PERIODS[entry.dayOfWeek];
  if (!day) return { durationMinutes: periodCount * 45, endTime: null };

  let startMinute = day.firstPeriodStartMinute;
  for (let period = 1; period < entry.startPeriod; period += 1) {
    startMinute += day.minutesPerPeriod + (day.breaksAfterPeriod[period] ?? 0);
  }

  let endMinute = startMinute;
  for (let period = entry.startPeriod; period <= entry.endPeriod; period += 1) {
    endMinute += day.minutesPerPeriod;
    if (period < entry.endPeriod) endMinute += day.breaksAfterPeriod[period] ?? 0;
  }

  const hours = Math.floor(endMinute / 60) % 24;
  const minutes = endMinute % 60;
  const endTime = `${hours.toString().padStart(2, "0")}.${minutes.toString().padStart(2, "0")}`;
  return { durationMinutes: periodCount * day.minutesPerPeriod, endTime };
}

export function formatDurationMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} menit`;
  if (minutes === 0) return `${hours} jam`;
  return `${hours} jam ${minutes} menit`;
}

const ENGLISH_DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

export function getJakartaDayIndex(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long"
  }).format(date);
  return ENGLISH_DAY_INDEX[weekday] ?? 0;
}

export function getJakartaDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function getJakartaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return year + "-" + month + "-" + day;
}

export function sortSessions(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort(
    (left, right) => left.startPeriod - right.startPeriod || left.endPeriod - right.endPeriod
  );
}

export function normalizeSubjectKey(subject: string): string {
  return subject.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function getTasksForSubject(entries: ScheduleEntry[], subject: string): ScheduleTask[] {
  const subjectKey = normalizeSubjectKey(subject);
  const tasks = new Map<string, ScheduleTask>();
  for (const entry of entries) {
    if (normalizeSubjectKey(entry.subject) !== subjectKey) continue;
    for (const task of entry.tasks ?? []) {
      if (tasks.has(task.id)) tasks.set(task.id, task);
      else if (tasks.size < 30) tasks.set(task.id, task);
    }
  }
  return [...tasks.values()];
}

export function formatPeriodRange(start: number, end: number): string {
  if (start === end) return "Jam " + start;
  return "Jam " + start + "–" + end;
}

export function validateScheduleDraft(
  draft: ScheduleDraft,
  dayEntries: ScheduleEntry[] = [],
  existingId?: string
): string | null {
  if (!draft.subject.trim()) return "Nama pelajaran harus diisi.";
  if (draft.subject.trim().length > 80) return "Nama pelajaran maksimal 80 karakter.";
  if (!Number.isInteger(draft.startPeriod) || draft.startPeriod < 1 || draft.startPeriod > 10) {
    return "Jam mulai harus antara 1 dan 10.";
  }
  if (!Number.isInteger(draft.endPeriod) || draft.endPeriod < 1 || draft.endPeriod > 10) {
    return "Jam selesai harus antara 1 dan 10.";
  }
  if (draft.startPeriod > draft.endPeriod) return "Jam selesai harus setelah jam mulai.";
  if (draft.room.trim().length > 80) return "Nama ruang maksimal 80 karakter.";
  if (draft.teacher.trim().length > 80) return "Nama guru maksimal 80 karakter.";
  if (!Number.isInteger(draft.dayOfWeek) || draft.dayOfWeek < 0 || draft.dayOfWeek > 6) {
    return "Pilih hari yang valid.";
  }
  const overlaps = dayEntries.some((entry) =>
    entry.id !== existingId &&
    draft.startPeriod <= entry.endPeriod &&
    draft.endPeriod >= entry.startPeriod
  );
  if (overlaps) return "Rentang jam bertabrakan dengan pelajaran lain.";
  return null;
}
