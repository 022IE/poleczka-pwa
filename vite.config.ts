import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Półeczka Iwonki',
        short_name: 'Półeczka',
        description: 'Sprzedaż, dostawy, koszty i analizy dla małej działalności.',
        theme_color: '#f5efe6',
        background_color: '#f7f4ef',
        display: 'standalone',
        start_url: '/',
        lang: 'pl'
      }
    })
  ]
})
