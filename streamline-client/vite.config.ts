import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'LIVEKIT_'], // <-- this line is key
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['localhost','magdalena-bulllike-hildred.ngrok-free.dev'],
    proxy: { '/v1': { target: 'http://localhost:3001', changeOrigin: true, secure: false } }
  },
})
