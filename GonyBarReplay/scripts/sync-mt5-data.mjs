// Copies MT5 exports from mt5/Mt5Data into public/data/mt5 and writes the manifest the app
// loads on startup as its built-in data. Runs before `npm run dev` and `npm run build`.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'mt5/Mt5Data';
const OUT = 'public/data';
const DEST = join(OUT, 'mt5');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => /\.(csv|txt)$/i.test(f)).sort() : [];
for (const f of files) copyFileSync(join(SRC, f), join(DEST, f));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ files: files.map((f) => `mt5/${f}`) }, null, 2) + '\n');
console.log(`sync-mt5-data: ${files.length} file(s) from ${SRC} → ${DEST}`);
