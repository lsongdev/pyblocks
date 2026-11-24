import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../src/firmware/images.json', import.meta.url), 'utf8'));
const directory = new URL('../public/firmware/', import.meta.url);
await mkdir(directory, { recursive: true });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

await Promise.all(Object.values(manifest).map(async image => {
  const target = new URL(image.file, directory);
  try {
    if (digest(await readFile(target)) === image.sha256) return;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  console.log(`Downloading firmware: ${image.file}`);
  const response = await fetch(image.url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${image.file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== image.sha256) throw new Error(`${image.file}: SHA-256 mismatch`);
  const temporary = new URL(`${image.file}.${process.pid}.tmp`, directory);
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
}));
