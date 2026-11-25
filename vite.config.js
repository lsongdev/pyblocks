import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { VitePWA } from 'vite-plugin-pwa';

const localResizable = fileURLToPath(new URL('../scripts/dom/resizable.js', import.meta.url));
const resizableUrl = 'https://lsong.org/scripts/dom/resizable.js';
const blocklyMedia = new URL('./node_modules/blockly/media/', import.meta.url);

// Bundle the shared module in standalone builds too, so offline resizing works.
function offlineAssets() {
  return {
    name: 'offline-assets',
    resolveId(id) {
      if (id === 'shared-panel-resizable') return '\0shared-panel-resizable';
    },
    async load(id) {
      if (id !== '\0shared-panel-resizable') return;
      const response = await fetch(resizableUrl);
      if (!response.ok) throw new Error(`Cannot bundle panel resizing: HTTP ${response.status}`);
      return response.text();
    },
    async generateBundle() {
      for (const file of await readdir(blocklyMedia)) {
        this.emitFile({ type: 'asset', fileName: `blockly-media/${file}`, source: await readFile(new URL(file, blocklyMedia)) });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    offlineAssets(),
    VitePWA({
      // Let updates wait until all app windows close; never reload an active editor.
      registerType: 'prompt',
      manifest: {
        id: './',
        name: 'PyBlocks',
        short_name: 'PyBlocks',
        description: 'Build MicroPython programs with blocks and connect to your board.',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#55448c',
        background_color: '#f2f1fa',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,gif,cur,mp3,bin,hex,uf2,txt}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // This is a single-page editor, scoped to its deployment directory.
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: existsSync(localResizable) ? { 'shared-panel-resizable': localResizable } : {},
  },
});
