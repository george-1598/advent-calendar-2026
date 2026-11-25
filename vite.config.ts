import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is served from https://george-1598.github.io/advent-calendar-2026/
export default defineConfig({
  base: '/advent-calendar-2026/',
  plugins: [react()],
});
