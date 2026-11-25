import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Separate from vite.config.js on purpose: Vitest prefers this file when present,
// and tests do not need the Tailwind plugin or the dev-server proxy.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    clearMocks: true,
  },
})