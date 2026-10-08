import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Edit3,
  FileText,
  ListTodo,
  Music2,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { useSchedule } from "./hooks/useSchedule";
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  WEEKDAY_ORDER,
  formatPeriodRange,
  getJakartaDateLabel,
  getJakartaDayIndex,
  sortSessions,
  type ScheduleDraft,
  type ScheduleEntry,
  type ScheduleTask
} from "./lib/schedule";

type ServerInfo = { lanUrls: string[] };

const desktopWidgetMode = new URLSearchParams(window.location.search).get("widget") === "1";
const spotifyPlaylistEmbedUrl = "https://open.spotify.com/embed/playlist/72c5HFfQJuhIy7faLYE69x?utm_source=generator&theme=0";

function newDraft(dayOfWeek: number): ScheduleDraft {
  return {
    dayOfWeek,
    subject: "",
    startPeriod: 1,
    endPeriod: 1,
    room: "",
    teacher: ""
  };
}

function getSavedProfileId(): string {
  try {
    return localStorage.getItem("jadwal-kelas:profile") ?? "";
  } catch {
    return "";
  }
}

function App() {
  const schedule = useSchedule();
  const [now, setNow] = useState(() => new Date());
  const todayIndex = getJakartaDayIndex(now);
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const [activeDay, setActiveDay] = useState(todayIndex);
  const [profileId, setProfileId] = useState(getSavedProfileId);
  const [serverInfo, setServerInfo] = useState<ServerInfo>({ lanUrls: [] });
  const [view, setView] = useState<"today" | "manage">("today");
  const [draft, setDraft] = useState(() => newDraft(todayIndex));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const appShellRef = useRef<HTMLElement | null>(null);
  const pauseAutoScrollForSpotifyRef = useRef<() => void>(() => {});

  const profile = schedule.snapshot.profiles.find((item) => item.id === profileId) ??
    schedule.snapshot.profiles[0] ?? null;
  const entries = profile?.entries ?? [];
  const selectedEntries = useMemo(
    () => sortSessions(entries.filter((entry) => entry.dayOfWeek === activeDay)),
    [activeDay, entries]
  );
  const serverOffline = schedule.status === "offline";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    const updateOnFocus = () => setNow(new Date());
    window.addEventListener("focus", updateOnFocus);
    document.addEventListener("visibilitychange", updateOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", updateOnFocus);
      document.removeEventListener("visibilitychange", updateOnFocus);
    };
  }, []);

  useEffect(() => {
    setActiveDay(todayIndex);
  }, [todayIndex, todayKey]);

  useEffect(() => {
    if (!schedule.snapshot.profiles.length) return;
    const exists = schedule.snapshot.profiles.some((item) => item.id === profileId);
    if (!exists) setProfileId(schedule.snapshot.profiles[0].id);
  }, [profileId, schedule.snapshot.profiles]);

  useEffect(() => {
    try {
      if (profileId) localStorage.setItem("jadwal-kelas:profile", profileId);
    } catch {
      // Profile selection is still available for the current visit.
    }
  }, [profileId]);

  useEffect(() => {
    let active = true;
    const loadInfo = async () => {
      try {
        const response = await fetch("/api/info", { cache: "no-store" });
        if (!response.ok) return;
        const info = await response.json() as ServerInfo;
        if (active && Array.isArray(info.lanUrls)) setServerInfo(info);
      } catch {
        // The schedule cache remains visible when the server is not reachable.
      }
    };
    void loadInfo();
    const timer = window.setInterval(() => void loadInfo(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!editingId) setDraft(newDraft(activeDay));
  }, [activeDay, editingId]);

  useEffect(() => {
    setOpenLessonId(null);
  }, [activeDay, profile?.id]);

  useEffect(() => {
    const ticker = appShellRef.current;
    if (!desktopWidgetMode || view !== "today" || openLessonId || !ticker || !selectedEntries.length) return;

    let disposed = false;
    let animationFrame = 0;
    let timer = 0;
    let manualPauseUntil = 0;
    let direction: 1 | -1 = 1;

    const scheduleNext = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(scrollToNextStop, delay);
    };

    const scrollToNextStop = () => {
      if (disposed) return;
      if (Date.now() < manualPauseUntil) {
        scheduleNext(manualPauseUntil - Date.now());
        return;
      }

      const maxScroll = ticker.scrollHeight - ticker.clientHeight;
      if (maxScroll < 14) {
        scheduleNext(2500);
        return;
      }

      const start = ticker.scrollTop;
      const target = direction === 1 ? maxScroll : 0;
      direction = direction === 1 ? -1 : 1;
      const duration = Math.max(1500, Math.min(3200, Math.abs(target - start) * 18));
      let startedAt = 0;

      const animate = (timestamp: number) => {
        if (disposed) return;
        if (Date.now() < manualPauseUntil) {
          animationFrame = 0;
          scheduleNext(manualPauseUntil - Date.now());
          return;
        }
        if (!startedAt) startedAt = timestamp;
        const progress = Math.min((timestamp - startedAt) / duration, 1);
        const eased = progress < .5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        ticker.scrollTop = start + (target - start) * eased;
        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(animate);
          return;
        }
        animationFrame = 0;
        scheduleNext(1900);
      };

      animationFrame = window.requestAnimationFrame(animate);
    };

    const pauseForManualScroll = () => {
      manualPauseUntil = Date.now() + 9000;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      scheduleNext(9000);
    };

    const pauseForSpotifyInteraction = () => {
      manualPauseUntil = Date.now() + 45_000;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      scheduleNext(45_000);
    };

    pauseAutoScrollForSpotifyRef.current = pauseForSpotifyInteraction;
    ticker.addEventListener("wheel", pauseForManualScroll, { passive: true });
    ticker.addEventListener("touchstart", pauseForManualScroll, { passive: true });
    ticker.addEventListener("pointerdown", pauseForManualScroll);
    ticker.addEventListener("keydown", pauseForManualScroll);
    scheduleNext(2600);

    return () => {
      disposed = true;
      pauseAutoScrollForSpotifyRef.current = () => {};
      window.clearTimeout(timer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      ticker.removeEventListener("wheel", pauseForManualScroll);
      ticker.removeEventListener("touchstart", pauseForManualScroll);
      ticker.removeEventListener("pointerdown", pauseForManualScroll);
      ticker.removeEventListener("keydown", pauseForManualScroll);
    };
  }, [activeDay, desktopWidgetMode, openLessonId, profile?.id, selectedEntries.length, view]);

  const selectProfile = (nextId: string) => {
    setProfileId(nextId);
    setEditingId(null);
    setDraft(newDraft(activeDay));
    setActionError(null);
    setActionNotice(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await schedule.save(profile.id, { ...draft, dayOfWeek: activeDay }, editingId ?? undefined);
      setDraft(newDraft(activeDay));
      setEditingId(null);
      setActionNotice("Pelajaran berhasil disimpan di server lokal.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Pelajaran belum berhasil disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (entry: ScheduleEntry) => {
    setDraft({
      dayOfWeek: entry.dayOfWeek,
      subject: entry.subject,
      startPeriod: entry.startPeriod,
      endPeriod: entry.endPeriod,
      room: entry.room ?? "",
      teacher: entry.teacher ?? ""
    });
    setEditingId(entry.id);
    setActionError(null);
    setActionNotice(null);
    document.getElementById("subject")?.focus();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(newDraft(activeDay));
    setActionError(null);
  };

  const handleDelete = async (entry: ScheduleEntry) => {
    if (!profile) return;
    if (!window.confirm("Hapus " + entry.subject + " dari hari " + DAY_LABELS[entry.dayOfWeek] + "?")) return;
    setActionError(null);
    setActionNotice(null);
    try {
      await schedule.remove(profile.id, entry.id);
      if (editingId === entry.id) cancelEdit();
      setActionNotice("Pelajaran berhasil dihapus.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Pelajaran belum berhasil dihapus.");
    }
  };

  const updateLessonDetails = async (
    entry: ScheduleEntry,
    details: { notes?: string; tasks?: ScheduleTask[] }
  ): Promise<boolean> => {
    if (!profile) return false;
    setActionError(null);
    try {
      await schedule.updateEntryDetails(profile.id, entry.id, details);
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Catatan atau tugas belum berhasil disimpan.");
      return false;
    }
  };

  const copyPhoneLink = async () => {
    const address = serverInfo.lanUrls[0];
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setActionNotice("Alamat server lokal disalin.");
      window.setTimeout(() => setActionNotice(null), 2500);
    } catch {
      setActionNotice("Alamat server HP: " + address);
    }
  };

  return (
    <main
      ref={appShellRef}
      className={"app-shell" + (desktopWidgetMode ? " desktop-widget" : "")}
      tabIndex={desktopWidgetMode ? 0 : undefined}
      aria-label={desktopWidgetMode ? "Jadwal kelas, gulir untuk melihat pesan semangat" : undefined}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><CalendarDays size={18} strokeWidth={2.3} /></span>
          <span className="brand-name">jadwal<span>kelas</span></span>
        </div>
        <div className="topbar-actions">
          <div className={"sync-pill " + (serverOffline ? "sync-offline" : "sync-online")} aria-live="polite">
            {serverOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
            <span>{schedule.status === "connecting" ? "Memuat" : serverOffline ? "Offline" : "Lokal aktif"}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => void schedule.refresh()} title="Muat ulang dari server lokal" aria-label="Muat ulang jadwal">
            <RefreshCw size={15} className={schedule.status === "connecting" ? "spin" : ""} />
          </button>
        </div>
      </header>

      <div className="profile-row">
        <label htmlFor="profile-select">Jadwal</label>
        <select
          id="profile-select"
          className="profile-select"
          value={profile?.id ?? ""}
          onChange={(event) => selectProfile(event.target.value)}
          disabled={!schedule.snapshot.profiles.length}
        >
          {schedule.snapshot.profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          {!schedule.snapshot.profiles.length ? <option value="">Belum ada profil</option> : null}
        </select>
      </div>

      <nav className="view-switch" aria-label="Tampilan jadwal">
        <button className={view === "today" ? "view-tab active" : "view-tab"} type="button" onClick={() => setView("today")}>
          <CalendarDays size={15} /> Jadwal
        </button>
        <button className={view === "manage" ? "view-tab active" : "view-tab"} type="button" onClick={() => { setView("manage"); setActionError(null); }}>
          <Edit3 size={15} /> Atur
        </button>
      </nav>

      {schedule.status === "connecting" && !schedule.snapshot.profiles.length ? (
        <div className="loading-box"><RefreshCw size={18} className="spin" /><span>Menghubungkan ke server jadwal…</span></div>
      ) : null}
      {serverOffline ? (
        <div className="notice notice-warning" role="status">
          <WifiOff size={15} />
          <span>{schedule.snapshot.profiles.length
            ? "Server tidak terjangkau. Jadwal terakhir tetap tampil, tapi belum bisa diedit."
            : "Nyalakan server lokal dengan perintah npm run start di laptop."}</span>
        </div>
      ) : null}
      {actionError ? <Notice kind="error" message={actionError} /> : null}
      {actionNotice ? <Notice kind="success" message={actionNotice} onDismiss={() => setActionNotice(null)} /> : null}

      {view === "today" ? (
        <section className="page-content" key={profile?.id + ":" + activeDay + ":today"} aria-labelledby="page-heading">
          <div className="page-heading">
            <div className="eyebrow-row"><span className="eyebrow-dot" />{getJakartaDateLabel(now)} · WIB</div>
            <div className="heading-line">
              <div>
                <h1 id="page-heading">{activeDay === todayIndex ? "Jadwal hari ini" : "Jadwal " + DAY_LABELS[activeDay]}</h1>
                <p className="subheading">{profile?.name ?? "Pilih jadwal"} · otomatis mengikuti hari Jakarta</p>
              </div>
              <div className="lesson-count"><strong>{selectedEntries.length.toString().padStart(2, "0")}</strong><span>mapel</span></div>
            </div>
          </div>

          <DayPicker activeDay={activeDay} todayIndex={todayIndex} onChange={setActiveDay} entries={entries} />

          <div className="section-heading">
            <div><span className="section-kicker">HARI SEKOLAH</span><h2>{DAY_LABELS[activeDay]}</h2></div>
            <span className="section-time"><Clock3 size={14} /> {selectedEntries.length} pelajaran</span>
          </div>

          {selectedEntries.length ? (
            <div
              className="schedule-list"
              role="region"
              aria-label="Daftar pelajaran"
            >
              {selectedEntries.map((entry, index) => (
                <LessonCard
                  entry={entry}
                  index={index}
                  key={entry.id}
                  open={openLessonId === entry.id}
                  disabled={serverOffline || !profile}
                  onToggle={() => setOpenLessonId((current) => current === entry.id ? null : entry.id)}
                  onUpdate={(details) => updateLessonDetails(entry, details)}
                />
              ))}
              <div className="motivation-card">
                <span className="motivation-spark">✦</span>
                <div><strong>Semangat terus, Daks!</strong><span>Geser jadwal, nanti balik lagi ke awal.</span></div>
                <span className="motivation-spark">✦</span>
              </div>
              <SpotifyPlaylist onInteraction={() => pauseAutoScrollForSpotifyRef.current()} />
            </div>
          ) : (
            <div className="empty-day">
              <div className="empty-illustration"><CalendarDays size={25} /></div>
              <h3>Hari {DAY_LABELS[activeDay]} masih kosong</h3>
              <p>{entries.length ? "Belum ada pelajaran di hari ini." : "Jadwal kosong. Isi dari menu Atur."}</p>
              <button className="text-button" type="button" onClick={() => setView("manage")}>Atur jadwal <Edit3 size={14} /></button>
            </div>
          )}
        </section>
      ) : (
        <section className="page-content manage-content" aria-labelledby="page-heading">
          <div className="page-heading">
            <div className="eyebrow-row"><span className="eyebrow-dot" />JADWAL MINGGUAN</div>
            <div className="heading-line">
              <div><h1 id="page-heading">Atur jadwal</h1><p className="subheading">Pilih jam pelajaran sesuai tabel sekolah.</p></div>
              <div className="manage-mark"><Edit3 size={18} /></div>
            </div>
          </div>

          <DayPicker
            activeDay={activeDay}
            todayIndex={todayIndex}
            onChange={(day) => { setActiveDay(day); setEditingId(null); setDraft(newDraft(day)); setActionError(null); }}
            entries={entries}
          />

          <form className="editor-card" onSubmit={handleSave}>
            <div className="editor-heading">
              <div className="editor-icon">{editingId ? <Edit3 size={17} /> : <Plus size={18} />}</div>
              <div><h2>{editingId ? "Ubah pelajaran" : "Tambah pelajaran"}</h2><p>{DAY_LABELS[activeDay]} · {profile?.name ?? ""}</p></div>
              {editingId ? <button className="editor-cancel" type="button" onClick={cancelEdit} aria-label="Batal mengedit"><X size={17} /></button> : null}
            </div>

            <label className="field-label" htmlFor="subject">Nama pelajaran</label>
            <input
              id="subject"
              className="text-input"
              type="text"
              maxLength={80}
              placeholder="Contoh: Matematika"
              value={draft.subject}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
              required
            />

            <div className="field-grid">
              <div>
                <label className="field-label" htmlFor="start-period">Jam mulai</label>
                <PeriodSelect id="start-period" value={draft.startPeriod} onChange={(value) => setDraft({ ...draft, startPeriod: value })} />
              </div>
              <div>
                <label className="field-label" htmlFor="end-period">Jam selesai</label>
                <PeriodSelect id="end-period" value={draft.endPeriod} onChange={(value) => setDraft({ ...draft, endPeriod: value })} />
              </div>
            </div>

            <div className="field-grid">
              <div><label className="field-label" htmlFor="teacher">Guru <span>opsional</span></label><input id="teacher" className="text-input" type="text" maxLength={80} placeholder="Kode guru" value={draft.teacher} onChange={(event) => setDraft({ ...draft, teacher: event.target.value })} /></div>
              <div><label className="field-label" htmlFor="room">Ruang <span>opsional</span></label><input id="room" className="text-input" type="text" maxLength={80} placeholder="Ruang kelas" value={draft.room} onChange={(event) => setDraft({ ...draft, room: event.target.value })} /></div>
            </div>

            <button className="primary-button save-button" type="submit" disabled={saving || serverOffline || !profile}>
              {saving ? <><RefreshCw size={15} className="spin" /> Menyimpan…</> : <><Check size={15} /> {editingId ? "Simpan perubahan" : "Tambah pelajaran"}</>}
            </button>
          </form>

          <div className="section-heading editor-list-heading">
            <div><span className="section-kicker">DAFTAR HARIAN</span><h2>{DAY_LABELS[activeDay]}</h2></div>
            <span className="count-chip">{selectedEntries.length} pelajaran</span>
          </div>

          {selectedEntries.length ? (
            <div className="manage-list">
              {selectedEntries.map((entry) => (
                <article className="manage-row" key={entry.id}>
                  <div className="manage-time">{formatPeriodRange(entry.startPeriod, entry.endPeriod)}</div>
                  <div className="manage-subject"><strong>{entry.subject}</strong><span>{[entry.teacher, entry.room].filter(Boolean).join(" · ") || "Belum ada guru atau ruang"}</span></div>
                  <div className="manage-actions">
                    <button className="icon-button edit-action" type="button" title={"Ubah " + entry.subject} aria-label={"Ubah " + entry.subject} onClick={() => beginEdit(entry)}><Edit3 size={14} /></button>
                    <button className="icon-button delete-action" type="button" title={"Hapus " + entry.subject} aria-label={"Hapus " + entry.subject} onClick={() => void handleDelete(entry)}><Trash2 size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="editor-empty"><CalendarDays size={18} /><div><strong>Belum ada pelajaran</strong><span>Tambahkan pelajaran untuk hari ini.</span></div></div>
          )}
        </section>
      )}

      <section className="phone-connect" aria-label="Sambungkan HP">
        <div className="phone-icon"><Smartphone size={16} /></div>
        <div className="phone-copy">
          <strong>Buka di HP</strong>
          <span>{serverInfo.lanUrls[0] ?? "Sambungkan HP dan laptop ke Wi-Fi yang sama"}</span>
        </div>
        {serverInfo.lanUrls[0] ? (
          <button className="icon-button copy-button" type="button" onClick={() => void copyPhoneLink()} title="Salin alamat" aria-label="Salin alamat untuk HP"><Copy size={14} /></button>
        ) : null}
      </section>

      <footer className="bottom-note">
        <span className={"status-dot " + (serverOffline ? "is-offline" : "")} />
        Jadwal tersimpan di laptop ini dan dibagikan lewat Wi-Fi lokal.
      </footer>
    </main>
  );
}

function SpotifyPlaylist({ onInteraction }: { onInteraction: () => void }) {
  return (
    <section
      className="spotify-playlist-card"
      aria-label="Playlist Spotify LUMIN kumpay"
      onPointerEnter={onInteraction}
      onPointerDown={onInteraction}
      onFocus={onInteraction}
    >
      <div className="spotify-playlist-heading">
        <span className="spotify-mark"><Music2 size={14} strokeWidth={2.5} /></span>
        <div><strong>LUMIN kumpay</strong><span>Playlist Spotify lu · 221 lagu</span></div>
        <span className="spotify-playlist-label">SPOTIFY</span>
      </div>
      <iframe
        className="spotify-playlist-embed"
        title="Putar playlist Spotify LUMIN kumpay"
        src={spotifyPlaylistEmbedUrl}
        width="100%"
        height="152"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      >
        Buka playlist LUMIN kumpay di Spotify.
      </iframe>
    </section>
  );
}

function LessonCard({
  entry,
  index,
  open,
  disabled,
  onToggle,
  onUpdate
}: {
  entry: ScheduleEntry;
  index: number;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
  onUpdate: (details: { notes?: string; tasks?: ScheduleTask[] }) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [taskText, setTaskText] = useState("");
  const [saving, setSaving] = useState(false);
  const tasks = entry.tasks ?? [];
  const arrivalDelay = `${Math.min(index, 8) * 95}ms`;

  useEffect(() => setNotes(entry.notes ?? ""), [entry.id, entry.notes]);

  const persist = async (details: { notes?: string; tasks?: ScheduleTask[] }): Promise<boolean> => {
    setSaving(true);
    try {
      return await onUpdate(details);
    } finally {
      setSaving(false);
    }
  };

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = taskText.trim();
    if (!text || tasks.length >= 30 || disabled || saving) return;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    void persist({ tasks: [...tasks, { id, text, done: false }] }).then((saved) => {
      if (saved) setTaskText("");
    });
  };

  const toggleTask = (taskId: string) => {
    if (disabled || saving) return;
    void persist({ tasks: tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task) });
  };

  const removeTask = (taskId: string) => {
    if (disabled || saving) return;
    void persist({ tasks: tasks.filter((task) => task.id !== taskId) });
  };

  return (
    <article
      className={"lesson-card lesson-tone-" + (index % 4) + (open ? " details-open" : "")}
      style={{ animationDelay: arrivalDelay, "--arrival-delay": arrivalDelay } as CSSProperties}
    >
      <div className="lesson-period">
        <strong>{entry.startPeriod.toString().padStart(2, "0")}</strong>
        <span>{entry.startPeriod === entry.endPeriod ? "1 jam" : entry.startPeriod + "–" + entry.endPeriod}</span>
      </div>
      <div className="lesson-main">
        <div className="lesson-title-row">
          <h3>{entry.subject}</h3>
          <button
            className="details-toggle"
            type="button"
            aria-expanded={open}
            aria-controls={`lesson-details-${entry.id}`}
            onClick={onToggle}
          >
            <FileText size={12} />
            <span>Catatan &amp; tugas</span>
            {tasks.length ? <b>{tasks.length}</b> : null}
            <ChevronDown size={12} className={open ? "chevron-open" : ""} />
          </button>
        </div>
        <div className="lesson-meta">
          {entry.teacher ? <span><UserRound size={13} />{entry.teacher}</span> : null}
          {entry.room ? <span>{entry.room}</span> : null}
          {!entry.teacher && !entry.room ? <span className="meta-quiet">Jam {entry.startPeriod} sampai {entry.endPeriod}</span> : null}
        </div>
      </div>
      {open ? (
        <div className="lesson-details" id={`lesson-details-${entry.id}`}>
          <label className="detail-label" htmlFor={`lesson-notes-${entry.id}`}>Catatan pelajaran</label>
          <textarea
            id={`lesson-notes-${entry.id}`}
            className="notes-input"
            maxLength={1200}
            placeholder="Tulis catatan untuk pelajaran ini…"
            value={notes}
            disabled={disabled || saving}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => {
              if (notes !== (entry.notes ?? "") && !disabled) void persist({ notes });
            }}
          />

          <div className="tasks-heading">
            <span><ListTodo size={13} /> Tugas</span>
            <small>{tasks.filter((task) => task.done).length}/{tasks.length} beres</small>
          </div>
          <form className="task-add-form" onSubmit={addTask}>
            <input
              className="task-input"
              type="text"
              maxLength={160}
              placeholder="Tambah tugas…"
              value={taskText}
              disabled={disabled || saving || tasks.length >= 30}
              onChange={(event) => setTaskText(event.target.value)}
            />
            <button type="submit" aria-label="Tambah tugas" disabled={disabled || saving || !taskText.trim() || tasks.length >= 30}>
              <Plus size={15} />
            </button>
          </form>
          {tasks.length ? (
            <ul className="lesson-task-list">
              {tasks.map((task, taskIndex) => (
                <li className={"lesson-task" + (task.done ? " is-done" : "")} key={task.id} style={{ animationDelay: `${taskIndex * 45}ms` }}>
                  <button className="task-check" type="button" aria-label={task.done ? "Tandai belum selesai" : "Tandai selesai"} aria-pressed={task.done} disabled={disabled || saving} onClick={() => toggleTask(task.id)}>
                    {task.done ? <Check size={11} /> : null}
                  </button>
                  <span>{task.text}</span>
                  <button className="task-remove" type="button" aria-label={"Hapus tugas " + task.text} disabled={disabled || saving} onClick={() => removeTask(task.id)}><X size={12} /></button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tasks-empty">Belum ada tugas. Tambah tugas di atas.</p>
          )}
          <div className="details-sync"><span className="status-dot" /> Tersimpan dan tersinkron ke HP lewat Wi-Fi lokal</div>
        </div>
      ) : null}
    </article>
  );
}

function PeriodSelect({ id, value, onChange }: { id: string; value: number; onChange: (value: number) => void }) {
  return (
    <select id={id} className="text-input period-select" value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {Array.from({ length: 10 }, (_, index) => index + 1).map((period) =>
        <option value={period} key={period}>Jam {period}</option>
      )}
    </select>
  );
}

function DayPicker({
  activeDay,
  todayIndex,
  onChange,
  entries
}: {
  activeDay: number;
  todayIndex: number;
  onChange: (day: number) => void;
  entries: ScheduleEntry[];
}) {
  return (
    <div className="day-picker" role="group" aria-label="Pilih hari">
      {WEEKDAY_ORDER.map((day) => {
        const count = entries.filter((entry) => entry.dayOfWeek === day).length;
        return (
          <button
            className={"day-option " + (activeDay === day ? "selected " : "") + (todayIndex === day ? "is-today" : "")}
            key={day}
            type="button"
            aria-pressed={activeDay === day}
            onClick={() => onChange(day)}
          >
            <span>{DAY_SHORT_LABELS[day]}</span>
            <i className={count ? "day-dot has-classes" : "day-dot"} />
          </button>
        );
      })}
    </div>
  );
}

function Notice({
  kind,
  message,
  onDismiss
}: {
  kind: "error" | "success";
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className={"notice notice-" + kind} role={kind === "error" ? "alert" : "status"}>
      <span>{kind === "success" ? <Check size={14} /> : <WifiOff size={14} />}</span>
      <p>{message}</p>
      {onDismiss ? <button type="button" onClick={onDismiss} aria-label="Tutup pemberitahuan"><X size={14} /></button> : null}
    </div>
  );
}

export default App;
