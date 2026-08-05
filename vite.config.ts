import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': el nuevo service worker espera; la app muestra el aviso de
      // actualización y el usuario decide (UpdatePrompt).
      registerType: 'prompt',
      // El registro lo hace el hook useRegisterSW (virtual:pwa-register/react);
      // evitar el script inyectado para no registrarlo dos veces.
      injectRegister: false,
      includeAssets: ['icono.svg', 'favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Gastos del Hogar',
        short_name: 'Gastos',
        description:
          'Gestiona el presupuesto común de tu hogar: gastos, servicios, ahorros y metas.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        lang: 'es',
        background_color: '#000000',
        theme_color: '#000000',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Vendors estables aparte: mejor caché (no se invalidan al cambiar
          // el código de la app) y carga en paralelo.
          if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-vendor'
          }
          if (id.includes('@tanstack')) return 'query'
        },
      },
    },
  },
})
