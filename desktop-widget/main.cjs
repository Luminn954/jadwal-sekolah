const { app, BrowserWindow, Menu, screen, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const scheduleOrigin = "http://127.0.0.1:4173";
const widgetUrl = `${scheduleOrigin}/?widget=1`;
const editorUrl = `${scheduleOrigin}/`;
let widgetWindow = null;
let userRequestedQuit = false;

app.setName("Jadwal Kelas");
app.setAppUserModelId("JadwalKelas.DesktopWidget");

// Path untuk menyimpan posisi jendela
const userDataPath = app.getPath("userData");
const positionFilePath = path.join(userDataPath, "widget-position.json");

// Fungsi untuk menyimpan posisi jendela
function saveWindowPosition() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const bounds = widgetWindow.getBounds();
  try {
    fs.writeFileSync(positionFilePath, JSON.stringify(bounds));
  } catch (err) {
    console.error("Gagal menyimpan posisi jendela:", err);
  }
}

// Fungsi untuk memuat posisi jendela
function loadWindowPosition() {
  try {
    if (fs.existsSync(positionFilePath)) {
      const data = fs.readFileSync(positionFilePath, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Gagal memuat posisi jendela:", err);
  }
  return null;
}

// Fungsi untuk memastikan jendela tetap di dalam layar
function ensureWindowVisible(bounds) {
  const displays = screen.getAllDisplays();
  let isVisible = false;

  // Cek apakah jendela masih di dalam salah satu display
  for (const display of displays) {
    const { x, y, width, height } = display.workArea;
    if (
      bounds.x >= x &&
      bounds.y >= y &&
      bounds.x + bounds.width <= x + width &&
      bounds.y + bounds.height <= y + height
    ) {
      isVisible = true;
      break;
    }
  }

  // Kalau ga visible, pindah ke posisi default
  if (!isVisible) {
    const area = screen.getPrimaryDisplay().workArea;
    bounds.x = Math.max(area.x, area.x + area.width - bounds.width - 14);
    bounds.y = area.y + 12;
  }

  return bounds;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(createWidgetWindow);
  app.on("activate", () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) createWidgetWindow();
    else widgetWindow.showInactive();
  });
}

app.on("window-all-closed", (e) => {
  // Kalau user mau quit lewat context menu, biarkan
  if (userRequestedQuit) {
    if (process.platform !== "darwin") app.quit();
    return;
  }

  // Kalau window crash atau ditutup accidental - RECREATE!
  console.log("Widget window closed, recreating in 2 seconds...");
  setTimeout(() => {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      console.log("Recreating widget window...");
      createWidgetWindow();
    }
  }, 2000);
});

function createWidgetWindow() {
  const width = 352;
  const height = 400;

  // Coba muat posisi tersimpan, atau pakai default
  let savedPosition = loadWindowPosition();
  let x, y;

  if (savedPosition) {
    savedPosition = ensureWindowVisible(savedPosition);
    x = savedPosition.x;
    y = savedPosition.y;
  } else {
    // Posisi default: kanan atas layar
    const area = screen.getPrimaryDisplay().workArea;
    x = Math.max(area.x, area.x + area.width - width - 14);
    y = area.y + 12;
  }

  widgetWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    opacity: 0,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  });

  widgetWindow.setMenuBarVisibility(false);
  widgetWindow.removeMenu();
  widgetWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(scheduleOrigin)) void shell.openExternal(url);
    return { action: "deny" };
  });
  widgetWindow.webContents.on("context-menu", (event) => {
    event.preventDefault();
    Menu.buildFromTemplate([
      { label: "Buka editor jadwal", click: () => void shell.openExternal(editorUrl) },
      { label: "Muat ulang widget", click: () => widgetWindow?.reload() },
      { type: "separator" },
      { label: "Tutup widget", click: () => { userRequestedQuit = true; app.quit(); } }
    ]).popup({ window: widgetWindow });
  });
  let fadeInterval = null;
  widgetWindow.once("ready-to-show", () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    widgetWindow.showInactive();
    const fadeStartedAt = Date.now();
    const fadeDuration = 360;
    fadeInterval = setInterval(() => {
      if (!widgetWindow || widgetWindow.isDestroyed()) {
        clearInterval(fadeInterval);
        fadeInterval = null;
        return;
      }
      const progress = Math.min((Date.now() - fadeStartedAt) / fadeDuration, 1);
      widgetWindow.setOpacity(1 - Math.pow(1 - progress, 3));
      if (progress >= 1) {
        clearInterval(fadeInterval);
        fadeInterval = null;
      }
    }, 16);
  });

  // Simpan posisi saat jendela dipindah
  widgetWindow.on("moved", () => {
    saveWindowPosition();
  });

  // Auto-save posisi setiap 30 detik (jaga-jaga kalau crash)
  const autoSaveInterval = setInterval(() => {
    saveWindowPosition();
  }, 30000);

  widgetWindow.on("closed", () => {
    clearInterval(autoSaveInterval);
    if (fadeInterval) clearInterval(fadeInterval);
    saveWindowPosition(); // Simpan sebelum ditutup
    widgetWindow = null;
  });

  void widgetWindow.loadURL(widgetUrl);
}
