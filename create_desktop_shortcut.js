const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = path.resolve(__dirname);
const vbsPath = path.join(appDir, 'launch.vbs');
const icoPath = path.join(appDir, 'logo.ico');

console.log('App directory:', appDir);
console.log('VBS launcher:', vbsPath);
console.log('Icon path:', icoPath);

// Detect all desktop directories on the system
const userProfile = process.env.USERPROFILE || 'C:\\Users\\LENOVO';
const candidateDesktops = [
  'D:\\OneDrive\\Máy tính',
  path.join(userProfile, 'Desktop'),
  path.join(userProfile, 'OneDrive', 'Desktop')
];

// Query Windows Registry for exact User Shell Folders Desktop
try {
  const regOut = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v Desktop', { encoding: 'utf8' });
  const match = regOut.match(/Desktop\s+REG_[^\s]+\s+(.+)/i);
  if (match && match[1]) {
    let p = match[1].trim();
    p = p.replace(/%USERPROFILE%/i, userProfile);
    candidateDesktops.unshift(p);
  }
} catch (e) {
  // Ignore registry query error
}

const validDesktops = Array.from(new Set(candidateDesktops.filter(d => fs.existsSync(d))));
console.log('Found valid desktop directories:', validDesktops);

// Also detect Windows Startup folder
let startupFolder = null;
try {
  const regStartup = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v Startup', { encoding: 'utf8' });
  const matchStartup = regStartup.match(/Startup\s+REG_[^\s]+\s+(.+)/i);
  if (matchStartup && matchStartup[1]) {
    let s = matchStartup[1].trim().replace(/%USERPROFILE%/i, userProfile);
    if (fs.existsSync(s)) startupFolder = s;
  }
} catch (e) {}

const targetFolders = [...validDesktops];

targetFolders.forEach(folder => {
  // Cleanup old obsolete shortcuts
  const obsoleteNames = [
    'Tro Ly Thu Mua - Farmers Market.lnk',
    'Trợ Lý Thu Mua - Farmers Market.lnk',
    'Farmers Market - Tro Ly Thu Mua.lnk',
    'Tro Ly Thu Mua.lnk'
  ];

  obsoleteNames.forEach(name => {
    const p = path.join(folder, name);
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
        console.log('Removed old shortcut:', p);
      } catch (err) {}
    }
  });

  try {
    const psScript = path.join(appDir, 'setup_desktop_shortcut.ps1');
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}"`, { stdio: 'inherit' });
    console.log('SUCCESS: Refreshed desktop shortcuts successfully.');
  } catch (err) {
    console.error('Error refreshing shortcuts:', err.message);
  }
});

console.log('\nAll shortcuts successfully refreshed with Farmers Market logo and silent one-click launcher!');
