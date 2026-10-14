const fs = require('fs');
const path = require('path');

try {
  const src = path.resolve(__dirname, '../src/types/sf-symbols-lib.d.ts');
  const destDir = path.resolve(__dirname, '../node_modules/sf-symbols-lib/dist');
  const dest = path.join(destDir, 'index.d.ts');

  if (fs.existsSync(src) && fs.existsSync(destDir)) {
    fs.copyFileSync(src, dest);
    console.log('[postinstall] Successfully synchronized sf-symbols-lib type definitions.');
  }
} catch (e) {
  console.warn('[postinstall] Notice: Could not sync sf-symbols-lib types:', e.message);
}
