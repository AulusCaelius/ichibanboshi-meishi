import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const publicDir = path.join(appRoot, 'public');
const distDir = path.join(appRoot, 'dist');
const prototypeDir = path.resolve(appRoot, '..', 'prototype');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// 1. Copy production static bundle (app/public -> app/dist)
fs.cpSync(publicDir, distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');

// 2. Include prototype mirror at app/dist/prototype/ for side-by-side comparison
if (fs.existsSync(prototypeDir)) {
  fs.cpSync(prototypeDir, path.join(distDir, 'prototype'), { recursive: true });
}

// 3. Verify all HTML local asset references exist in app/dist
const htmlFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.html'));
const missing = [];
for (const f of htmlFiles) {
  const html = fs.readFileSync(path.join(distDir, f), 'utf-8');
  const refs = [...html.matchAll(/(?:href|src)="(assets\/[^"?#]+)/g)].map((m) => m[1]);
  for (const rel of refs) {
    if (!fs.existsSync(path.join(distDir, rel))) {
      missing.push(`${f} -> ${rel}`);
    }
  }
}

if (missing.length) {
  console.error('Missing built assets:\n' + missing.join('\n'));
  process.exit(1);
}

console.log(`Built ${htmlFiles.length} production pages into ${distDir} (prototype included at /prototype/).`);
