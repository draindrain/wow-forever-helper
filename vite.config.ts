import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites from /<repo>/. The deploy workflow sets
// BASE_PATH; local dev and preview run from the root.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
});
