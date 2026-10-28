import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'offline' ? [viteSingleFile()] : [])],
  base: mode === 'pages' ? '/roadmaster1002/' : './',
  define: { 'import.meta.env.VITE_STATIC_MODE': JSON.stringify(mode === 'pages' || mode === 'offline' ? 'true' : 'false') },
  build: { outDir: mode === 'pages' ? 'dist-pages' : mode === 'offline' ? 'dist-offline' : 'dist' },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
}));
