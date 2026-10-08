import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { test } from "node:test";
import { createScheduleStore, seedSnapshot, validateProfiles } from "./store.mjs";

test("starts with an empty schedule for a new installation", () => {
  const snapshot = seedSnapshot();
  assert.equal(snapshot.profiles.length, 1);
  assert.equal(snapshot.profiles[0].name, "Jadwal 1");
  assert.deepEqual(snapshot.profiles[0].entries, []);
});

test("server-side validation rejects overlapping or invalid periods", () => {
  const profiles = seedSnapshot().profiles;
  profiles[0].entries.push({
    id: "contoh",
    dayOfWeek: 1,
    subject: "Contoh",
    startPeriod: 1,
    endPeriod: 2,
    room: null,
    teacher: null
  });
  profiles[0].entries.push({
    id: "overlap",
    dayOfWeek: 1,
    subject: "Tes",
    startPeriod: 2,
    endPeriod: 3,
    room: null,
    teacher: null
  });
  assert.equal(validateProfiles(profiles), "Jam pelajaran dalam satu hari tidak boleh bertabrakan.");
  profiles[0].entries.pop();
  profiles[0].entries[0].endPeriod = 11;
  assert.equal(validateProfiles(profiles), "Ada pelajaran dengan data tidak valid.");
});

test("schedule data survives a local file reload", async () => {
  const parent = await mkdtemp(join(tmpdir(), "jadwal-kelas-test-"));
  const resolvedParent = resolve(parent);
  const resolvedTemp = resolve(tmpdir());
  assert.ok(resolvedParent.startsWith(resolvedTemp + sep));
  try {
    const filePath = join(parent, "schedules.json");
    const firstStore = createScheduleStore(filePath);
    const initial = await firstStore.load();
    const changed = { ...initial, revision: initial.revision + 1 };
    await firstStore.write(changed);
    const secondStore = createScheduleStore(filePath);
    assert.deepEqual(await secondStore.load(), changed);
    const savedText = await readFile(filePath, "utf8");
    assert.match(savedText, /Jadwal 1/);
  } finally {
    await rm(resolvedParent, { recursive: true, force: true });
  }
});
