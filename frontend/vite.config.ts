import react from '@vitejs/plugin-react-swc';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Charger .env depuis la racine du projet (parent de frontend/) pour VITE_SUPABASE_* et VITE_TAGS_MASTER_CODE
  envDir: resolve(__dirname, '..'),
  plugins: [react()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: {
    port: 5173,
    // Proxy pour le développement : redirige les appels API vers le serveur Oracle Cloud
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://138.2.182.125:8080',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/health': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://138.2.182.125:8080',
        changeOrigin: true,
      },
    },
  },
  base: './',
  build: { outDir: 'dist' }
});
