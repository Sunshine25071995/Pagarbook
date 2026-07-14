import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: !isProduction && process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      sourcemap: false,        // optional, reduces size
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: undefined, // or optimize as needed
        },
      },
    },
    define: {
      // Ensure no dev-only code leaks
      'import.meta.hot': 'undefined',
    },
  };
});