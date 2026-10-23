import { app, BrowserWindow, ipcMain, shell, utilityProcess } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';
import { fork, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: any = null;
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
function waitForServer(url: string, timeoutMs: number = 30000): Promise<boolean> {
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
      req.setTimeout(1500, () => {
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

// Start backend server
async function startBackendServer(port: number): Promise<void> {
  const { serverEntry, clientDist } = getAppPaths();
  const dbPath = setupDatabasePath();

  console.log(`[Electron] Launching backend server on port ${port}...`);
  console.log(`[Electron] Server entry: ${serverEntry}`);
  console.log(`[Electron] Database path: ${dbPath}`);

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: port.toString(),
    HOST: '127.0.0.1',
    NODE_ENV: app.isPackaged ? 'production' : 'development',
    DATABASE_PATH: dbPath,
    DB_PATH: dbPath,
    CLIENT_DIST_PATH: clientDist,
    ELECTRON_RUN: 'true',
  };

  try {
    if (utilityProcess && typeof utilityProcess.fork === 'function') {
      serverProcess = utilityProcess.fork(serverEntry, [], {
        env,
        stdio: 'pipe',
        serviceName: 'fm-backend-service',
      });

      serverProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`[Server] ${data.toString().trim()}`);
      });

      serverProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[Server ERR] ${data.toString().trim()}`);
      });

      serverProcess.on('exit', (code: number) => {
        console.log(`[Electron] Server utilityProcess exited with code ${code}`);
      });
    } else {
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
        console.log(`[Electron] Server process exited with code ${code}, signal ${signal}`);
      });
    }
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

  // Clean native look (hide standard browser menu bar)
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

  const targetUrl = `http://localhost:${serverPort}`;
  console.log(`[Electron] Loading main window from ${targetUrl}`);
  await mainWindow.loadURL(targetUrl);

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

  const healthy = await waitForServer(`http://127.0.0.1:${serverPort}/health`, 25000);
  if (!healthy) {
    console.warn('[Electron] Backend health check timed out, attempting to load window anyway...');
  } else {
    console.log('[Electron] Backend server is healthy and responding!');
  }

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
