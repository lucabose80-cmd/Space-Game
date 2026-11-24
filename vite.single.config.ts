import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        format: 'iife',
        name: 'StarlighterApp',
        entryFileNames: 'bundle.js',
        assetFileNames: 'bundle.[ext]',
      },
    },
  },
});
