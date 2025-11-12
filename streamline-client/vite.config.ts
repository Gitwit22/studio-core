import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // expose LIVEKIT_ to the client (alongside VITE_)
  envPrefix: ['VITE_', 'LIVEKIT_'],
  server: {
    host: true,
    proxy: {
      '/v1': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
