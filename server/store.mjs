import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function seedSnapshot() {
  return {
    revision: 1,
    profiles: [
      {
        id: "jadwal-1",
        name: "Jadwal 1",
        entries: []
      }
    ]
  };
}

function validText(value, maxLength, optional = false) {
  if (value === null && optional) return true;
  return typeof value === "string" &&
    value.trim().length <= maxLength &&
    (optional || value.trim().length > 0);
}

export function validateProfiles(profiles) {
  if (!Array.isArray(profiles) || profiles.length < 1 || profiles.length > 10) {
    return "Data harus berisi 1 sampai 10 jadwal.";
  }
  const profileIds = new Set();
  for (const profile of profiles) {
    if (!profile || typeof profile !== "object" ||
      !validText(profile.id, 80) || !validText(profile.name, 60) ||
      !Array.isArray(profile.entries) || profile.entries.length > 500) {
      return "Profil jadwal tidak valid.";
    }
    if (profileIds.has(profile.id)) return "ID profil jadwal harus unik.";
    profileIds.add(profile.id);
    const entryIds = new Set();
    const dayEntries = new Map();
    for (const item of profile.entries) {
      if (!item || typeof item !== "object" ||
        !validText(item.id, 100) || !validText(item.subject, 80) ||
        !Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 0 || item.dayOfWeek > 6 ||
        !Number.isInteger(item.startPeriod) || item.startPeriod < 1 || item.startPeriod > 10 ||
        !Number.isInteger(item.endPeriod) || item.endPeriod < 1 || item.endPeriod > 10 ||
        item.startPeriod > item.endPeriod ||
        !validText(item.teacher, 80, true) ||
        !validText(item.room, 80, true) ||
        (item.notes !== undefined && !validText(item.notes, 1200, true)) ||
        (item.tasks !== undefined && (!Array.isArray(item.tasks) || item.tasks.length > 30 ||
          item.tasks.some((task) => !task || typeof task !== "object" ||
            !validText(task.id, 100) || !validText(task.text, 160) || typeof task.done !== "boolean")))) {
        return "Ada pelajaran dengan data tidak valid.";
      }
      if (item.tasks && new Set(item.tasks.map((task) => task.id)).size !== item.tasks.length) {
        return "ID tugas harus unik dalam satu pelajaran.";
      }
      if (entryIds.has(item.id)) return "ID pelajaran harus unik dalam satu jadwal.";
      entryIds.add(item.id);
      const lessons = dayEntries.get(item.dayOfWeek) ?? [];
      if (lessons.some((other) =>
        item.startPeriod <= other.endPeriod && item.endPeriod >= other.startPeriod
      )) {
        return "Jam pelajaran dalam satu hari tidak boleh bertabrakan.";
      }
      lessons.push(item);
      dayEntries.set(item.dayOfWeek, lessons);
    }
  }
  return null;
}

export function createScheduleStore(filePath) {
  return {
    async load() {
      try {
        const text = await readFile(filePath, "utf8");
        const snapshot = JSON.parse(text);
        if (!Number.isInteger(snapshot.revision) || snapshot.revision < 1 ||
          validateProfiles(snapshot.profiles)) {
          throw new Error("File jadwal tersimpan tidak valid: " + filePath);
        }
        return snapshot;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          const initial = seedSnapshot();
          await this.write(initial);
          return initial;
        }
        throw error;
      }
    },
    async write(snapshot) {
      await mkdir(dirname(filePath), { recursive: true });
      const temporaryPath = filePath + "." + process.pid + ".tmp";
      await writeFile(temporaryPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
      await rename(temporaryPath, filePath);
    }
  };
}
