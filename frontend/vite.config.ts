import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const publishedEnv = loadEnv('production', '.', 'VITE_')
if (publishedEnv.VITE_HOSTED === '1' && !/^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.up\.railway\.app$/.test(publishedEnv.VITE_API_ORIGIN ?? '')) {
  throw new Error('Set VITE_API_ORIGIN to the verified Railway HTTPS origin.')
}

export default defineConfig({
  cacheDir: loadEnv('development', '.', 'VECTOR_X_VITE_').VECTOR_X_VITE_CACHE ?? 'node_modules/.vite',
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/node_modules/three/build/three.core.js')) return 'three-core'
    if (id.includes('/node_modules/three/')) return 'three-renderer'
  } } } },
  plugins: [react({ include: /\/src\/.*\.[jt]sx?$/ })],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api/v1': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
})
