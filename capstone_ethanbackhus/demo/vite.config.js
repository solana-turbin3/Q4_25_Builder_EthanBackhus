import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Optional: allow replacing BASE at build time
    'process.env': {}
  }
});
