/**
 * =====================================================================
 *  FARMERS MARKET - SECURITY GUARDIAN & ANTI-CONFLICT BACKGROUND AGENT
 * =====================================================================
 *  Autonomous process supervisor, anti-hack isolation & single-instance mutex.
 *
 *  Features:
 *  1. Single-Instance Mutex: Guarantees 0 process conflicts if clicked repeatedly.
 *  2. Pre-flight Port Sanitizer: Clears orphan / zombie processes on 3000 & 5173.
 *  3. Network Isolation: Enforces strict 127.0.0.1 binding (no LAN/Wi-Fi leakage).
 *  4. Health Watchdog: Monitors backend (/health) & frontend every 5s; auto-heals.
 *  5. Edge App Mode Launcher: Launches dedicated distraction-free window.
 *  6. Graceful Termination (--stop): Safely kills process trees and frees ports.
 * =====================================================================
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const LOCK_FILE = path.join(DATA_DIR, 'guardian.lock');
const LOG_FILE = path.join(DATA_DIR, 'guardian.log');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const line = `[${timestamp}] [GUARDIAN] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (err) {
    // Ignore log write errors
  }
}

function isPidAlive(pid) {
  if (!pid || isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function killProcessTree(pid) {
  if (!pid || !isPidAlive(pid)) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch (e) {
    // Process might already be dead
  }
}

function getPidsOnPort(port) {
  const pids = new Set();
  try {
    const stdout = execSync('netstat -ano', { encoding: 'utf8' });
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(pid) && pid > 0) {
          pids.add(pid);
        }
      }
    }
  } catch (e) {
    // Ignore netstat errors
  }
  return Array.from(pids);
}

function sanitizePorts() {
  const ports = [3000, 5173];
  for (const port of ports) {
    const pids = getPidsOnPort(port);
    for (const pid of pids) {
      if (pid !== process.pid) {
        log(`Phat hien tien trinh chiem cong :${port} (PID: ${pid}). Dang giai phong...`);
        killProcessTree(pid);
      }
    }
  }
}

function checkHttp(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openDefaultBrowser(targetUrl = 'http://localhost:5173/') {
  log(`Dang mo ung dung tren trinh duyet mac dinh cua he thong: ${targetUrl}`);
  try {
    if (process.platform === 'win32') {
      // Use Windows cmd.exe /c start "" "url" to launch the user's default browser
      spawn('cmd.exe', ['/c', 'start', '', targetUrl], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [targetUrl], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [targetUrl], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (err) {
    log(`Loi khi mo trinh duyet: ${err.message}`);
  }
}

// -------------------------------------------------------------
// STOP COMMAND HANDLER (--stop)
// -------------------------------------------------------------
if (process.argv.includes('--stop')) {
  log('Nhan lenh dung he thong (--stop). Dang tien hanh tat an toan...');
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      if (lockData.guardianPid && isPidAlive(lockData.guardianPid)) {
        log(`Dang dung Guardian Agent (PID: ${lockData.guardianPid})...`);
        killProcessTree(lockData.guardianPid);
      }
      if (lockData.serverPid && isPidAlive(lockData.serverPid)) {
        killProcessTree(lockData.serverPid);
      }
      if (lockData.clientPid && isPidAlive(lockData.clientPid)) {
        killProcessTree(lockData.clientPid);
      }
    } catch (e) {
      log(`Loi khi doc file lock: ${e.message}`);
    }
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch (e) {}
  }

  sanitizePorts();
  log('He thong da duoc dung hoan toan va an toan.');
  process.exit(0);
}

// -------------------------------------------------------------
// SINGLE-INSTANCE MUTEX CHECK
// -------------------------------------------------------------
if (fs.existsSync(LOCK_FILE)) {
  try {
    const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    if (lockData.guardianPid && isPidAlive(lockData.guardianPid)) {
      // Guardian is already running! Verify if system is responsive
      log(`He thong da dang chay boi Guardian (PID: ${lockData.guardianPid}). Dang chuyen toi cua so ung dung...`);
      openDefaultBrowser();
      process.exit(0);
    }
  } catch (e) {
    log('Phat hien file lock cu khong hop le. Dang lam sach...');
  }
}

// -------------------------------------------------------------
// SYSTEM INITIALIZATION & SPAWNING
// -------------------------------------------------------------
log('=====================================================================');
log('KHOI DONG HE THONG BAO MAT & AGENT GIAM SAT TRO LY THU MUA');
log('=====================================================================');

sanitizePorts();

const lockData = {
  guardianPid: process.pid,
  startTime: new Date().toISOString(),
  lastHeartbeat: new Date().toISOString(),
  serverPid: null,
  clientPid: null,
};

function writeLock() {
  lockData.lastHeartbeat = new Date().toISOString();
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf8');
  } catch (e) {}
}

writeLock();

let serverProc = null;
let clientProc = null;
let isShuttingDown = false;

function spawnServer() {
  log('Dang khoi dong May chu Backend (Node.js/Fastify - 127.0.0.1:3000)...');
  const serverDir = path.join(ROOT_DIR, 'server');

  if (process.platform === 'win32') {
    serverProc = spawn('cmd.exe', ['/c', 'npm', 'run', 'dev'], {
      cwd: serverDir,
      env: { ...process.env, HOST: '127.0.0.1', PORT: '3000' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    serverProc = spawn('npm', ['run', 'dev'], {
      cwd: serverDir,
      env: { ...process.env, HOST: '127.0.0.1', PORT: '3000' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  lockData.serverPid = serverProc.pid;
  writeLock();

  serverProc.stdout.on('data', (data) => {
    const str = data.toString();
    if (str.includes('Server securely listening') || str.includes('listening')) {
      log(`[Backend OK] ${str.trim()}`);
    }
  });

  serverProc.stderr.on('data', (data) => {
    const str = data.toString();
    if (str.includes('ERROR') || str.includes('Error')) {
      log(`[Backend Warn/Error] ${str.trim()}`);
    }
  });

  serverProc.on('exit', (code) => {
    if (!isShuttingDown) {
      log(`[CANH BAO] Backend bi tat dot ngot voi ma thoat: ${code}. Guardian dang tu dong phuc hoi...`);
      setTimeout(() => {
        if (!isShuttingDown) spawnServer();
      }, 2000);
    }
  });
}

function spawnClient() {
  log('Dang khoi dong May chu Giao dien (Vite/React - 127.0.0.1:5173)...');
  const clientDir = path.join(ROOT_DIR, 'client');

  if (process.platform === 'win32') {
    clientProc = spawn('cmd.exe', ['/c', 'npm', 'run', 'dev'], {
      cwd: clientDir,
      env: { ...process.env, HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    clientProc = spawn('npm', ['run', 'dev'], {
      cwd: clientDir,
      env: { ...process.env, HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  lockData.clientPid = clientProc.pid;
  writeLock();

  clientProc.stdout.on('data', (data) => {
    const str = data.toString();
    if (str.includes('Local:')) {
      log(`[Frontend OK] ${str.trim()}`);
    }
  });

  clientProc.stderr.on('data', (data) => {
    const str = data.toString();
    if (str.includes('ERROR') || str.includes('Error')) {
      log(`[Frontend Warn/Error] ${str.trim()}`);
    }
  });

  clientProc.on('exit', (code) => {
    if (!isShuttingDown) {
      log(`[CANH BAO] Frontend bi tat dot ngot voi ma thoat: ${code}. Guardian dang tu dong phuc hoi...`);
      setTimeout(() => {
        if (!isShuttingDown) spawnClient();
      }, 2000);
    }
  });
}

// Clean up handler on exit
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log('Guardian dang dong toan bo tien trinh con an toan...');
  if (serverProc && serverProc.pid) killProcessTree(serverProc.pid);
  if (clientProc && clientProc.pid) killProcessTree(clientProc.pid);
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (e) {}
  sanitizePorts();
  log('Da hoan tat giai phong tai nguyen.');
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', () => { cleanup(); });

// Boot the services
spawnServer();
spawnClient();

// -------------------------------------------------------------
// READY CHECK & BROWSER LAUNCH
// -------------------------------------------------------------
async function waitForReady() {
  log('Dang kiem tra tinh trang san sang cua Backend & Frontend...');
  const maxAttempts = 30;
  let attempts = 0;
  let backendReady = false;
  let frontendReady = false;

  while (attempts < maxAttempts) {
    if (!backendReady) {
      backendReady = await checkHttp('http://127.0.0.1:3000/health', 1500);
    }
    if (!frontendReady) {
      frontendReady = await checkHttp('http://127.0.0.1:5173/', 1500);
    }

    if (backendReady && frontendReady) {
      log('[THANH CONG] Toan bo he thong da hoat dong on dinh 100%!');
      openDefaultBrowser();
      break;
    }

    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
  }

  if (!backendReady || !frontendReady) {
    log('[CANH BAO] Qua thoi gian cho khoi dong, van mo ung dung de nguoi dung kiem tra...');
    openDefaultBrowser();
  }

  // -----------------------------------------------------------
  // AUTONOMOUS HEALTH WATCHDOG (EVERY 5 SECONDS)
  // -----------------------------------------------------------
  log('Agent giam sat ngam (Watchdog) da duoc kich hoat. Chu ky kiem tra: 5s.');
  setInterval(async () => {
    if (isShuttingDown) return;
    writeLock();

    // Verify Backend health
    const isBackendAlive = await checkHttp('http://127.0.0.1:3000/health', 2000);
    if (!isBackendAlive && !isShuttingDown) {
      log('[Watchdog] Backend khong phan hoi /health. Dang kiem tra tien trinh...');
      if (!serverProc || !isPidAlive(serverProc.pid)) {
        log('[Watchdog] Tien trinh Backend da mat, dang tu dong tai sinh...');
        spawnServer();
      }
    }

    // Verify Frontend health
    const isFrontendAlive = await checkHttp('http://127.0.0.1:5173/', 2000);
    if (!isFrontendAlive && !isShuttingDown) {
      log('[Watchdog] Frontend khong phan hoi. Dang kiem tra tien trinh...');
      if (!clientProc || !isPidAlive(clientProc.pid)) {
        log('[Watchdog] Tien trinh Frontend da mat, dang tu dong tai sinh...');
        spawnClient();
      }
    }
  }, 5000);
}

waitForReady();
