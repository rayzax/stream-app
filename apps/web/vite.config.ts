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
        scope: '/',
        start_url: '/',
        background_color: '#0B0D10',
        theme_color: '#3B82F6',
      },
      // generateSW (Workbox default) for now — swap to injectManifest with a
      // custom src/sw.ts later if we need bespoke caching for video segments.
      strategies: 'generateSW',
    }),
  ],
})
