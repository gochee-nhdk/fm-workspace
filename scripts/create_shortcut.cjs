/**
 * FM WORKSPACE — Cross-Platform Desktop Shortcut Creator
 * Supports Windows (LNK with hotkey Ctrl+Alt+F), macOS (App/Command launcher), and Linux (.desktop)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

console.log('[Shortcut] Dang tao phim tat Desktop cho he dieu hanh:', process.platform);

if (isWin) {
  const psScript = path.join(rootDir, 'scripts', 'create_shortcut.ps1');
  if (fs.existsSync(psScript)) {
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}"`, {
        cwd: rootDir,
        stdio: 'inherit',
      });
    } catch (err) {
      console.warn('[Shortcut Warning] Khong the tao shortcut qua PowerShell:', err.message);
    }
  }
} else if (isMac) {
  const desktopDir = path.join(os.homedir(), 'Desktop');
  if (fs.existsSync(desktopDir)) {
    const startScript = path.join(rootDir, 'start.sh');
    const commandPath = path.join(desktopDir, 'FM Workspace.command');
    const appPath = path.join(desktopDir, 'FM Workspace.app');

    // 1. Tao FM Workspace.command launcher
    try {
      const commandContent = `#!/usr/bin/env bash\ncd "${rootDir}"\n./start.sh\n`;
      fs.writeFileSync(commandPath, commandContent, { mode: 0o755 });
      console.log('✅ Da tao shortcut Desktop:', commandPath);
    } catch (err) {
      console.warn('[Shortcut Warning] Khong the tao .command:', err.message);
    }

    // 2. Tao native macOS .app bang osacompile neu co the
    try {
      const appleScript = `do shell script "cd \\"${rootDir}\\" && ./start.sh > /dev/null 2>&1 &"`;
      execSync(`osacompile -e '${appleScript}' -o "${appPath}"`, { stdio: 'ignore' });
      
      // Neu co logo.png hoac logo.icns, copy lam icon ung dung
      const iconSrc = path.join(rootDir, 'build', 'icon.png');
      const icnsDest = path.join(appPath, 'Contents', 'Resources', 'applet.icns');
      if (fs.existsSync(iconSrc)) {
        try {
          execSync(`sips -s format icns "${iconSrc}" --out "${icnsDest}"`, { stdio: 'ignore' });
        } catch (_) {}
      }
      console.log('✅ Da tao ung dung macOS Desktop:', appPath);
    } catch (_) {
      // Neu osacompile khong san sang thi .command o tren van hoat dong 100%
    }
  }
} else if (isLinux) {
  const desktopDir = path.join(os.homedir(), 'Desktop');
  if (fs.existsSync(desktopDir)) {
    const desktopFile = path.join(desktopDir, 'fm-workspace.desktop');
    const content = `[Desktop Entry]\nName=FM Workspace\nComment=Farmers Market Procurement Assistant\nExec="${path.join(rootDir, 'start.sh')}"\nIcon=${path.join(rootDir, 'build', 'icon.png')}\nTerminal=false\nType=Application\nCategories=Office;\n`;
    try {
      fs.writeFileSync(desktopFile, content, { mode: 0o755 });
      console.log('✅ Da tao shortcut Linux Desktop:', desktopFile);
    } catch (err) {
      console.warn('[Shortcut Warning] Khong the tao .desktop file:', err.message);
    }
  }
}
