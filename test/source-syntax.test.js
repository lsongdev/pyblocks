import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('all browser source modules parse, including the DOM entry point', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  for (const file of readdirSync(root, { recursive: true }).filter(file => file.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, file + '\n' + (result.stderr || result.error?.message || ''));
  }
});
