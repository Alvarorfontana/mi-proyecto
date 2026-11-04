import { defineConfig } from 'vite';
export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@myriaddreamin/typst.ts', '@myriaddreamin/typst-ts-web-compiler', '@myriaddreamin/typst-ts-renderer'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
