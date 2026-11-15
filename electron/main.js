// TubeLens desktop shell. Starts the bundled Next.js server on localhost and
// shows it in a window. Keys, the database and the log live in the user's
// app-data folder, never inside the app itself.
const { app, BrowserWindow, Menu, dialog, shell, utilityProcess } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// Fixed, because the Google OAuth redirect address has to be registered in advance.
const PORT = 3111;
const ORIGIN = `http://localhost:${PORT}`;

let win = null;
let server = null;
let quitting = false;
let signingIn = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- configuration in the user's app-data folder ----

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const TEMPLATE = `# TubeLens settings. Save this file, then quit and reopen TubeLens.
# Every value is optional: with none set, the app runs on demo data.

# Connect your YouTube channel (Google Cloud OAuth client, type "Web application").
# Add this authorised redirect URI to it: ${ORIGIN}/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Public YouTube search (Outliers, Keywords, Competitors).
YOUTUBE_API_KEY=

# AI Coach (free key at https://aistudio.google.com/apikey).
GEMINI_API_KEY=
`;

function loadConfig(dataDir) {
  const file = path.join(dataDir, ".env.local");
  if (!fs.existsSync(file)) fs.writeFileSync(file, TEMPLATE, { mode: 0o600 });
  const env = parseEnv(fs.readFileSync(file, "utf8"));
  // The session secret encrypts the sign-in cookie. Generate it once and keep it.
  const secretFile = path.join(dataDir, "session-secret");
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  env.SESSION_SECRET = fs.readFileSync(secretFile, "utf8").trim();
  return env;
}

// ---- the bundled server ----

function serverDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(__dirname, "..", ".next", "standalone");
}

// The build ships the server's dependencies as "modules" (electron-builder
// drops folders named node_modules). Link them back so Node finds them. If the
// app folder is read-only, run from a copy in the data folder instead.
function ensureModules(dir, dataDir) {
  const link = path.join(dir, "node_modules");
  if (fs.existsSync(link) || !fs.existsSync(path.join(dir, "modules"))) return dir;
  try {
    fs.symlinkSync("modules", link, "dir");
    return dir;
  } catch {
    const copy = path.join(dataDir, `server-${app.getVersion()}`);
    if (!fs.existsSync(path.join(copy, "node_modules"))) {
      fs.rmSync(copy, { recursive: true, force: true });
      fs.cpSync(dir, copy, { recursive: true, dereference: true });
      fs.renameSync(path.join(copy, "modules"), path.join(copy, "node_modules"));
    }
    return copy;
  }
}

function startServer(dataDir, config) {
  const dir = ensureModules(serverDir(), dataDir);
  const entry = path.join(dir, "server.js");
  if (!fs.existsSync(entry)) throw new Error(`Server files are missing (${entry}). Run "npm run desktop:build" first.`);
  const log = fs.createWriteStream(path.join(dataDir, "server.log"), { flags: "a" });
  server = utilityProcess.fork(entry, [], {
    cwd: dir,
    stdio: "pipe",
    env: {
      ...config,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      APP_URL: ORIGIN,
      DATABASE_PATH: path.join(dataDir, "tubelens.db"),
      TUBELENS_DESKTOP: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  server.stdout?.on("data", (d) => log.write(d));
  server.stderr?.on("data", (d) => log.write(d));
  server.on("exit", (code) => {
    log.write(`\n[desktop] server exited with code ${code}\n`);
    if (!quitting) {
      dialog.showErrorBox("TubeLens stopped", `The built-in server stopped unexpectedly (code ${code}). Details are in server.log in the settings folder.`);
      app.quit();
    }
  });
}

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`${ORIGIN}/api/quota`);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  throw new Error(`The server did not start. Another program may be using port ${PORT}.`);
}

// ---- window ----

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b0c13",
    title: "TubeLens",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.on("closed", () => (win = null));

  // Links to other sites open in the normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ORIGIN)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${ORIGIN}/api/auth/google`)) {
      event.preventDefault();
      connectYouTube();
    } else if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  win.loadURL(`${ORIGIN}/feed`);
}

// Google won't show its sign-in page inside an embedded window, so sign-in runs
// in the system browser. The local server hands the finished session to this
// app under a secret one-time code.
async function connectYouTube() {
  if (signingIn) return;
  signingIn = true;
  try {
    const nonce = crypto.randomBytes(32).toString("hex");
    await shell.openExternal(`${ORIGIN}/api/auth/google?desktop=${nonce}`);
    const deadline = Date.now() + 5 * 60_000;
    while (Date.now() < deadline) {
      await sleep(1500);
      const res = await fetch(`${ORIGIN}/api/auth/desktop?nonce=${nonce}`).catch(() => null);
      if (!res || res.status !== 200) continue;
      const { session, next } = await res.json();
      const ses = win?.webContents.session;
      if (!ses) return;
      const base = { url: ORIGIN, httpOnly: true, sameSite: "lax", path: "/", expirationDate: Math.floor(Date.now() / 1000) + 30 * 86400 };
      await ses.cookies.set({ ...base, name: "tl_session", value: session });
      await ses.cookies.set({ ...base, name: "tl_mode", value: "live" });
      win.loadURL(`${ORIGIN}${next}`);
      win.show();
      win.focus();
      return;
    }
  } finally {
    signingIn = false;
  }
}

function buildMenu(dataDir) {
  const open = (name) => () => shell.openPath(path.join(dataDir, name));
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "TubeLens",
        submenu: [
          { role: "about" },
          { type: "separator" },
          { label: "Edit API Keys…", accelerator: "CmdOrCtrl+,", click: open(".env.local") },
          { label: "Show Data Folder", click: () => shell.showItemInFolder(path.join(dataDir, "tubelens.db")) },
          { label: "Open Server Log", click: open("server.log") },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [{ role: "reload" }, { role: "forceReload" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "togglefullscreen" }],
      },
      { role: "windowMenu" },
    ]),
  );
}

// ---- lifecycle ----

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const dataDir = app.getPath("userData");
      fs.mkdirSync(dataDir, { recursive: true });
      buildMenu(dataDir);
      startServer(dataDir, loadConfig(dataDir));
      await waitForServer();
      createWindow();
    } catch (err) {
      dialog.showErrorBox("TubeLens couldn't start", String(err && err.message ? err.message : err));
      app.quit();
    }
  });

  app.on("activate", () => {
    if (!win && server) createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    quitting = true;
    server?.kill();
  });
}
