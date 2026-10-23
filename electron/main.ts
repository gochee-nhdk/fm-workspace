import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';
import { fork, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort = 3000;

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Helper: Check if a port is available
function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let p = startPort; p < startPort + 20; p++) {
    const isAvail = await checkPortAvailable(p);
    if (isAvail) return p;
  }
  return startPort;
}

// Helper: Poll server health
function waitForServer(url: string, timeoutMs: number = 25000): Promise<boolean> {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', () => retry());
      req.setTimeout(1200, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(check, 350);
      }
    };

    check();
  });
}

// Locate paths based on packaged vs unpackaged environment
function getAppPaths() {
  const isPackaged = app.isPackaged;
  const appPath = app.getAppPath();
  const resourcesPath = process.resourcesPath;

  let serverEntry = path.join(appPath, 'server', 'dist', 'index.js');
  let clientDist = path.join(appPath, 'client', 'dist');

  if (isPackaged) {
    const unpackedServer = path.join(resourcesPath, 'server', 'dist', 'index.js');
    const unpackedClient = path.join(resourcesPath, 'client', 'dist');
    if (fs.existsSync(unpackedServer)) {
      serverEntry = unpackedServer;
    }
    if (fs.existsSync(unpackedClient)) {
      clientDist = unpackedClient;
    }
  }

  return { serverEntry, clientDist };
}

// Ensure database path in persistent user data directory
function setupDatabasePath(): string {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const targetDbPath = path.join(userDataDir, 'procurement.db');

  // If target db does not exist, check if an existing local db exists to migrate
  if (!fs.existsSync(targetDbPath)) {
    const candidates = [
      path.join(app.getAppPath(), 'data', 'procurement.db'),
      path.join(app.getAppPath(), 'server', 'data', 'procurement.db'),
      path.join(app.getAppPath(), 'server', 'data', 'app.db'),
      path.join(process.resourcesPath, 'data', 'procurement.db'),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          fs.copyFileSync(cand, targetDbPath);
          console.log(`[Electron] Successfully migrated database from ${cand} to ${targetDbPath}`);
          break;
        } catch (err) {
          console.warn('[Electron] Could not migrate database:', err);
        }
      }
    }
  }

  return targetDbPath;
}

// Start backend server as pure Node process (ELECTRON_RUN_AS_NODE: '1')
async function startBackendServer(port: number): Promise<void> {
  const { serverEntry, clientDist } = getAppPaths();
  const dbPath = setupDatabasePath();

  console.log(`[Electron] Launching backend server on port ${port}...`);
  console.log(`[Electron] Server entry: ${serverEntry}`);
  console.log(`[Electron] Database path: ${dbPath}`);

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PORT: port.toString(),
    HOST: '127.0.0.1',
    NODE_ENV: app.isPackaged ? 'production' : 'development',
    DATABASE_PATH: dbPath,
    DB_PATH: dbPath,
    CLIENT_DIST_PATH: clientDist,
    ELECTRON_RUN: 'true',
    ELECTRON_RUN_AS_NODE: '1', // Crucial: forces child process to run as Node.js, not Electron GUI
  };

  try {
    serverProcess = fork(serverEntry, [], {
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Server ERR] ${data.toString().trim()}`);
    });

    serverProcess.on('exit', (code: number, signal: string) => {
      console.log(`[Electron] Server child process exited with code ${code}, signal ${signal}`);
    });
  } catch (err) {
    console.error('[Electron] Failed to spawn backend server:', err);
  }
}

function getIconPath(): string {
  const candidates = [
    path.join(__dirname, '../../build/icon.ico'),
    path.join(__dirname, '../build/icon.ico'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'logo.ico'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return '';
}

function getSplashScreenHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      color: #ffffff;
      user-select: none;
      overflow: hidden;
    }
    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border-radius: 32px;
      padding: 44px 36px;
      display: flex; flex-direction: column; align-items: center;
      box-shadow: 0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15);
      width: 360px;
      text-align: center;
    }
    .icon-box {
      width: 80px; height: 80px;
      border-radius: 24px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 40px;
      box-shadow: 0 12px 30px rgba(16, 185, 129, 0.35);
      margin-bottom: 22px;
    }
    h1 {
      margin: 0 0 6px 0;
      font-size: 22px; font-weight: 700;
      letter-spacing: -0.5px;
    }
    p {
      margin: 0 0 24px 0;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.65);
      line-height: 1.4;
    }
    .spinner-ring {
      width: 24px; height: 24px;
      border: 2.5px solid rgba(16, 185, 129, 0.2);
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .badge {
      margin-top: 24px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      display: flex; align-items: center; gap: 6px;
    }
    .badge-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #10b981;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">🌾</div>
    <h1>FM Workspace</h1>
    <p id="msg">Đang khởi động hệ thống cục bộ...</p>
    <div class="spinner-ring" id="spinner"></div>
    <div class="badge">
      <span class="badge-dot"></span>
      <span>Local-First • SQLite Engine</span>
    </div>
  </div>
</body>
</html>`;
}

// Create the main application window
async function createMainWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: 'FM Workspace - AI Procurement & Merchandising Assistant',
    backgroundColor: '#0b0f19',
    show: false,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // Intercept navigation to external domains and open them in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!url.includes(`localhost:${serverPort}`) && !url.includes(`127.0.0.1:${serverPort}`)) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.includes(`localhost:${serverPort}`) && !url.includes(`127.0.0.1:${serverPort}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 1. Immediately display the Apple Liquid Glass Splash screen
  const splashUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(getSplashScreenHtml());
  await mainWindow.loadURL(splashUrl);

  // 2. Wait for server to become healthy, then navigate to the workspace
  const healthy = await waitForServer(`http://127.0.0.1:${serverPort}/health`, 25000);
  if (healthy && mainWindow) {
    const targetUrl = `http://localhost:${serverPort}`;
    console.log(`[Electron] Server is ready! Loading main window from ${targetUrl}`);
    await mainWindow.loadURL(targetUrl);
  } else if (mainWindow) {
    console.warn('[Electron] Backend health check timed out, attempting direct load...');
    await mainWindow.loadURL(`http://localhost:${serverPort}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());

// App lifecycle
app.whenReady().then(async () => {
  serverPort = await findAvailablePort(3000);
  await startBackendServer(serverPort);
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

function cleanupServer() {
  if (serverProcess) {
    console.log('[Electron] Stopping backend server child process...');
    try {
      if (typeof serverProcess.kill === 'function') {
        serverProcess.kill('SIGTERM');
      }
    } catch (_) {}
    serverProcess = null;
  }
}

app.on('before-quit', cleanupServer);
app.on('window-all-closed', () => {
  cleanupServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
