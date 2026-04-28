import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: process.env.VITE_API_PROXY_TARGET
      ? {
          '/api': {
            target: process.env.VITE_API_PROXY_TARGET,
            changeOrigin: true,
          },
          '/ws': {
            target: process.env.VITE_API_PROXY_TARGET,
            changeOrigin: true,
            ws: true,
          },
          '/instruct_photos': {
            target: process.env.VITE_API_PROXY_TARGET,
            changeOrigin: true,
          },
        }
      : undefined,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
