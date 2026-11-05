/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'port-isolated-dependency-cache',
      config(config, env) {
        // Parallel Ionic/dev servers must not rename the same optimizer cache on Windows.
        if (env.command === 'serve' && !env.isPreview && !config.cacheDir) {
          const mode = env.mode.replace(/[^a-zA-Z0-9_-]/g, '_')
          return { cacheDir: `node_modules/.vite/${mode}-${config.server?.port ?? 5173}` }
        }
      },
    },
    vue(),
    tailwindcss(),
    legacy(),
    {
      name: 'self-host-legacy-browser-check',
      enforce: 'post',
      // plugin-legacy's data: module imports conflict with a strict script CSP.
      // Keep its fallback checks, serving the tiny detector from our own origin.
      generateBundle(_options, bundle) {
        for (const [name, output] of Object.entries(bundle)) {
          const replace = (code: string) => code.replace(/import(['"])data:text\/javascript,[\s\S]*?\1/g,
            `import '/security/modern-browser-check.js?entry=${encodeURIComponent(name)}'`);
          if (output.type === 'chunk') output.code = replace(output.code);
          else if (name.endsWith('.html') && typeof output.source === 'string') output.source = replace(output.source);
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: { ignored: ['**/.cache/**', '**/.audit/**', '**/android/**/build/**'] },
  },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    globals: true,
    environment: 'jsdom'
  }
})
