import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Get base path from environment variable or default to '/'
// Set VITE_BASE_PATH in GitHub Actions if deploying to a subdirectory
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base: base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});

