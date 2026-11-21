import { useCallback, useEffect, useRef, useState } from "react";
import {
  getTasksForSubject,
  normalizeSubjectKey,
  sortSessions,
  validateScheduleDraft,
  type ScheduleDraft,
  type ScheduleEntry,
  type ScheduleProfile,
  type ScheduleTask,
  type ScheduleSnapshot
} from "../lib/schedule";

export type ServerStatus = "connecting" | "online" | "offline";

const CACHE_KEY = "jadwal-kelas:local:v2";

function isScheduleEntry(value: unknown): value is ScheduleEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ScheduleEntry>;
  return typeof entry.id === "string" &&
    typeof entry.subject === "string" &&
    Number.isInteger(entry.dayOfWeek) &&
    Number.isInteger(entry.startPeriod) &&
    Number.isInteger(entry.endPeriod);
}

function isScheduleSnapshot(value: unknown): value is ScheduleSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ScheduleSnapshot>;
  return Number.isInteger(snapshot.revision) &&
    Array.isArray(snapshot.profiles) &&
    snapshot.profiles.every((profile) =>
      Boolean(profile) &&
      typeof profile.id === "string" &&
      typeof profile.name === "string" &&
      Array.isArray(profile.entries) &&
      profile.entries.every(isScheduleEntry)
    );
}

function readCache(): ScheduleSnapshot {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isScheduleSnapshot(parsed)) return parsed;
    }
  } catch {
    // A server refresh still works when browser storage is unavailable.
  }
  return { revision: 0, profiles: [] };
}

function saveCache(snapshot: ScheduleSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // The local server remains the source of truth when browser storage is full.
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "Server lokal belum bisa dijangkau.";
}

export function useSchedule() {
  const [snapshot, setSnapshot] = useState<ScheduleSnapshot>(readCache);
  const [status, setStatus] = useState<ServerStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  const refreshGeneration = useRef(0);
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const statusRef = useRef(status);
  statusRef.current = status;

  const enqueueMutation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const queued = mutationQueueRef.current.then(operation, operation);
    mutationQueueRef.current = queued.then(() => undefined, () => undefined);
    return queued;
  }, []);

  const acceptSnapshot = useCallback((next: ScheduleSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    saveCache(next);
  }, []);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    try {
      const response = await fetch("/api/schedules", { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result
          ? String((result as { error: unknown }).error)
          : "Server lokal menolak permintaan.";
        throw new Error(message);
      }
      if (!isScheduleSnapshot(result)) throw new Error("Data jadwal dari server tidak valid.");
      if (generation !== refreshGeneration.current) return;
      if (result.revision >= snapshotRef.current.revision) acceptSnapshot(result);
      setStatus("online");
      setError(null);
    } catch (nextError) {
      if (generation !== refreshGeneration.current) return;
      setStatus("offline");
      setError(errorMessage(nextError));
    }
  }, [acceptSnapshot]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 15_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const persist = useCallback(async (profiles: ScheduleProfile[]) => {
    if (statusRef.current !== "online") throw new Error("Server lokal lagi offline. Hubungkan dulu ke laptop.");
    const response = await fetch("/api/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: snapshotRef.current.revision, profiles })
    });
    const result: unknown = await response.json();
    if (response.status === 409) {
      await refresh();
      throw new Error("Jadwal berubah dari perangkat lain. Data terbaru sudah dimuat; coba simpan lagi.");
    }
    if (!response.ok) {
      const message = result && typeof result === "object" && "error" in result
        ? String((result as { error: unknown }).error)
        : "Jadwal belum berhasil disimpan.";
      throw new Error(message);
    }
    if (!isScheduleSnapshot(result)) throw new Error("Server memberi balasan jadwal yang tidak valid.");
    acceptSnapshot(result);
    setStatus("online");
    setError(null);
  }, [acceptSnapshot, refresh]);

  const save = useCallback(async (
    profileId: string,
    draft: ScheduleDraft,
    existingId?: string
  ) => enqueueMutation(async () => {
    const profile = snapshotRef.current.profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error("Pilih jadwal yang tersedia.");
    const sameDay = profile.entries.filter((entry) => entry.dayOfWeek === draft.dayOfWeek);
    const validation = validateScheduleDraft(draft, sameDay, existingId);
    if (validation) throw new Error(validation);

    const previousEntry = existingId ? profile.entries.find((entry) => entry.id === existingId) : undefined;
    const subjectChanged = previousEntry && normalizeSubjectKey(previousEntry.subject) !== normalizeSubjectKey(draft.subject);
    const saved: ScheduleEntry = {
      id: existingId ?? newId(),
      dayOfWeek: draft.dayOfWeek,
      subject: draft.subject.trim(),
      startPeriod: draft.startPeriod,
      endPeriod: draft.endPeriod,
      room: draft.room.trim() || null,
      teacher: draft.teacher.trim() || null,
      notes: previousEntry?.notes ?? "",
      tasks: previousEntry && !subjectChanged
        ? previousEntry.tasks ?? []
        : getTasksForSubject(profile.entries, draft.subject)
    };
    const nextProfile = {
      ...profile,
      entries: sortSessions(existingId
        ? profile.entries.map((entry) => entry.id === existingId ? saved : entry)
        : [...profile.entries, saved])
    };
    await persist(snapshotRef.current.profiles.map((item) =>
      item.id === profileId ? nextProfile : item
    ));
    return saved;
  }), [enqueueMutation, persist]);

  const updateEntryDetails = useCallback(async (
    profileId: string,
    entryId: string,
    details: { notes?: string; tasks?: ScheduleTask[] }
  ) => enqueueMutation(async () => {
    if (details.notes !== undefined && details.notes.length > 1200) {
      throw new Error("Catatan maksimal 1.200 karakter.");
    }
    if (details.tasks !== undefined && details.tasks.length > 30) {
      throw new Error("Maksimal 30 tugas untuk satu pelajaran.");
    }
    const profile = snapshotRef.current.profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error("Pilih jadwal yang tersedia.");
    const existing = profile.entries.find((entry) => entry.id === entryId);
    if (!existing) throw new Error("Pelajaran tidak ditemukan.");
    const subjectKey = normalizeSubjectKey(existing.subject);
    const nextProfile = {
      ...profile,
      entries: profile.entries.map((entry) => {
        const sameSubject = normalizeSubjectKey(entry.subject) === subjectKey;
        if (details.tasks !== undefined && sameSubject) {
          return {
            ...entry,
            tasks: details.tasks,
            ...(entry.id === entryId && details.notes !== undefined ? { notes: details.notes } : {})
          };
        }
        return entry.id === entryId ? { ...entry, ...details } : entry;
      })
    };
    await persist(snapshotRef.current.profiles.map((item) =>
      item.id === profileId ? nextProfile : item
    ));
  }), [enqueueMutation, persist]);

  const remove = useCallback((profileId: string, entryId: string) => enqueueMutation(async () => {
    const profiles = snapshotRef.current.profiles.map((profile) =>
      profile.id === profileId
        ? { ...profile, entries: profile.entries.filter((entry) => entry.id !== entryId) }
        : profile
    );
    await persist(profiles);
  }), [enqueueMutation, persist]);

  return { snapshot, status, error, refresh, save, remove, updateEntryDetails };
}
