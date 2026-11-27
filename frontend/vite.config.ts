import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  cacheDir: loadEnv('development', '.', 'VECTOR_X_VITE_').VECTOR_X_VITE_CACHE ?? 'node_modules/.vite',
  plugins: [react({ include: /\/src\/.*\.[jt]sx?$/ })],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api/v1': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
})
