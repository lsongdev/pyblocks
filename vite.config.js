import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const localResizable = fileURLToPath(new URL('../scripts/dom/resizable.js', import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: existsSync(localResizable) ? { 'https://lsong.org/scripts/dom/resizable.js': localResizable } : {},
  },
});
