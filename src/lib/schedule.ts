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
