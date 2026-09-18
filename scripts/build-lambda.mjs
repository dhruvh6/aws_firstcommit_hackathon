import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(rootDir, 'infra', '.build');

console.log('Building Lambda bundle with esbuild...');
execSync(
  `npx esbuild api/src/index.ts --bundle --platform=node --target=node22 --outfile=infra/.build/handler.mjs --format=esm --external:@aws-sdk/*`,
  { cwd: rootDir, stdio: 'inherit' },
);

console.log('Copying fixtures into Lambda bundle...');
fs.cpSync(path.join(rootDir, 'fixtures'), path.join(outDir, 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));

console.log('Lambda build complete in infra/.build/');
