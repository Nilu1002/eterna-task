import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://eterna-backend-7c5v.onrender.com',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
})
