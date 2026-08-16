import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sourceDir = join(process.cwd(), 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco');
const targetDir = join(process.cwd(), 'public', 'draco');

if (!existsSync(sourceDir)) {
  console.warn('[HYACYN] Draco decoder source not found. Run npm install again after three is installed.');
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

function copyRecursive(source, target) {
  const stat = statSync(source);

  if (stat.isDirectory()) {
    mkdirSync(target, { recursive: true });

    for (const entry of readdirSync(source)) {
      copyRecursive(join(source, entry), join(target, entry));
    }

    return;
  }

  copyFileSync(source, target);
}

for (const file of readdirSync(sourceDir)) {
  copyRecursive(join(sourceDir, file), join(targetDir, file));
}

console.log('[HYACYN] Copied Draco decoder assets to public/draco.');
