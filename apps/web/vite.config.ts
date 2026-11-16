import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Stream',
        short_name: 'Stream',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        background_color: '#0B0D10',
        theme_color: '#0B0D10',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // generateSW (Workbox default) for now — swap to injectManifest with a
      // custom src/sw.ts later if we need bespoke caching for video segments.
      strategies: 'generateSW',
      workbox: {
        // Don't precache the on-demand player chunks (hls.js/mpegts.js) —
        // they're already lazy-loaded; precaching them would undo the
        // cellular-friendly deferred load on first install.
        globIgnores: ['**/hls-*.js', '**/mpegts-*.js'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/stream': 'http://localhost:8080',
    },
  },
})
