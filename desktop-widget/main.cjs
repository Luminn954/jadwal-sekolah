const { app, BrowserWindow, Menu, screen, shell } = require("electron");

const scheduleOrigin = "http://127.0.0.1:4173";
const widgetUrl = `${scheduleOrigin}/?widget=1`;
const editorUrl = `${scheduleOrigin}/`;
let widgetWindow = null;

app.setName("Jadwal Kelas");
app.setAppUserModelId("JadwalKelas.DesktopWidget");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(createWidgetWindow);
  app.on("activate", () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) createWidgetWindow();
    else widgetWindow.showInactive();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function createWidgetWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  const width = 352;
  const height = 400;
  const x = Math.max(area.x, area.x + area.width - width - 14);
  const y = area.y + 12;

  widgetWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
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
      { label: "Tutup widget", click: () => app.quit() }
    ]).popup({ window: widgetWindow });
  });
  widgetWindow.once("ready-to-show", () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    widgetWindow.showInactive();
  });
  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });

  void widgetWindow.loadURL(widgetUrl);
}
