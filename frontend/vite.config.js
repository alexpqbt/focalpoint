import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,     // expose to LAN so phones can reach it
    port: 5173,
    proxy: {
      '/config':       'http://127.0.0.1:5000',
      '/token':        'http://127.0.0.1:5000',
      '/participants': 'http://127.0.0.1:5000',
      '/logs':         'http://127.0.0.1:5000',
    },
  },
})
