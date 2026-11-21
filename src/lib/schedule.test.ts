import { describe, expect, it } from "vitest";
import {
  formatDurationMinutes,
  getLessonTiming,
  getTasksForSubject,
  getJakartaDateKey,
  getJakartaDayIndex,
  sortSessions,
  validateScheduleDraft,
  type ScheduleDraft,
  type ScheduleEntry
} from "./schedule";

const entry = (id: string, startPeriod: number, endPeriod: number, dayOfWeek = 3): ScheduleEntry => ({
  id,
  dayOfWeek,
  subject: id,
  startPeriod,
  endPeriod,
  room: null,
  teacher: null
});

describe("Jakarta calendar", () => {
  it("uses the Jakarta weekday and date across the UTC day boundary", () => {
    const date = new Date("2026-10-06T18:30:00.000Z");
    expect(getJakartaDayIndex(date)).toBe(3);
    expect(getJakartaDateKey(date)).toBe("2026-10-07");
  });
});

describe("weekly schedule", () => {
  it("sorts classes by their first lesson period", () => {
    expect(sortSessions([entry("second", 4, 5), entry("first", 1, 2)]).map((item) => item.id))
      .toEqual(["first", "second"]);
  });

  it("rejects blank subjects, invalid ranges, and overlapping periods", () => {
    const draft: ScheduleDraft = {
      dayOfWeek: 3,
      subject: "   ",
      startPeriod: 3,
      endPeriod: 2,
      room: "",
      teacher: ""
    };
    expect(validateScheduleDraft(draft)).toBe("Nama pelajaran harus diisi.");
    expect(validateScheduleDraft({ ...draft, subject: "Matematika" })).toBe("Jam selesai harus setelah jam mulai.");
    expect(validateScheduleDraft(
      { ...draft, subject: "Matematika", startPeriod: 2, endPeriod: 4 },
      [entry("occupied", 1, 3)]
    )).toBe("Rentang jam bertabrakan dengan pelajaran lain.");
    expect(validateScheduleDraft({ ...draft, subject: "Matematika", startPeriod: 3, endPeriod: 4 })).toBeNull();
    expect(validateScheduleDraft({ ...draft, subject: "Matematika", startPeriod: 0, endPeriod: 2 })).toBe(
      "Jam mulai harus antara 1 dan 10."
    );
  });

  it("allows an edited class to keep its own existing period range", () => {
    const existing = entry("edit-me", 1, 3);
    expect(validateScheduleDraft({
      dayOfWeek: 3,
      subject: "MTK",
      startPeriod: 1,
      endPeriod: 3,
      room: "",
      teacher: ""
    }, [existing], existing.id)).toBeNull();
  });

  it("calculates lesson duration and end time using school breaks", () => {
    expect(getLessonTiming(entry("Tue morning", 1, 4, 2))).toEqual({
      durationMinutes: 180,
      endTime: "09.30"
    });
    expect(getLessonTiming(entry("Tue afternoon", 9, 10, 2))).toEqual({
      durationMinutes: 90,
      endTime: "15.00"
    });
    expect(getLessonTiming(entry("Friday", 5, 6, 5))).toEqual({
      durationMinutes: 80,
      endTime: "10.45"
    });
    expect(formatDurationMinutes(180)).toBe("3 jam");
  });

  it("shares tasks across repeated lessons with the same subject", () => {
    const monday = { ...entry("monday", 1, 2, 1), subject: " Matematika " };
    const thursday = { ...entry("thursday", 3, 4, 4), subject: "MATEMATIKA", tasks: [
      { id: "task-1", text: "Latihan", done: false }
    ] };
    expect(getTasksForSubject([monday, thursday], "matematika")).toEqual(thursday.tasks);
  });
});
