import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Use relative paths for Electron
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            try {
              const parts = id.split('node_modules/')[1].split('/');
              // Handle scoped packages like @radix-ui/react-dialog
              const pkg = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
              // Normalize chunk name
              const safeName = pkg.replace('@', '').replace('/', '-');
              return `vendor-${safeName}`;
            } catch (e) {
              return 'vendor';
            }
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})


