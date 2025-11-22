import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,

    // Proxy ALL /api requests to your backend (including admin routes)
    proxy: {
      '/api': {
        target: 'http://localhost:5137',
        changeOrigin: true,
        secure: false,
      },
    },

    // Allow ANY ngrok domain
    allowedHosts: ['.ngrok-free.dev'],
  },
})
