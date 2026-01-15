import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: {
    port: 5173,
    // Proxy configuration to forward API calls during development to the Koyeb service.
    // This avoids CORS errors when the frontend is served from localhost.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'https://dependent-klarika-rorymercury91-e1486cf2.koyeb.app',
        changeOrigin: true,
        // Keep the /api prefix when proxying to the target.
        rewrite: (path) => path,
      },
      '/health': {
        target: process.env.VITE_API_PROXY_TARGET || 'https://dependent-klarika-rorymercury91-e1486cf2.koyeb.app',
        changeOrigin: true,
      },
    },
  },
  base: './',
  build: { outDir: 'dist' }
});