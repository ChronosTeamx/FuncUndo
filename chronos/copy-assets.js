const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'wasm');
const destDir = path.join(__dirname, 'dist', 'wasm');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);

for (const file of files) {
  if (file.endsWith('.wasm')) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));

    console.log(`Copied asset: ${file}`);
  }
}
