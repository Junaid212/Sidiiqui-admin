import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Serve all assets from root — required for Nginx serving from /var/www/admin
  base: '/',

  build: {
    outDir: 'dist',
    // Warn if a chunk exceeds 1 MB (helps catch oversized bundles)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split vendor libs into a separate chunk for better browser caching
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },

  // Dev server proxy — only active during `npm run dev`, ignored in production build
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
