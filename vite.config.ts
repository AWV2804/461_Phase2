/// <reference types="vitest" />
import { defineConfig } from 'vite';
//import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    exclude: ['test/testing_data/**', 'node_modules', 'test/frontend_e2e/**', 'test/postman_tests/**'],
    include: ['test/**/**'], // Include .jsx and .tsx files
    testTimeout: 40000,
    globals: true,
    includeSource: ['src/**/*.{js,jsx,tsx}'], // Include .jsx and .tsx files
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json-summary', 'html'], // Add 'html' for detailed report
      reportsDirectory: './coverage',
      include: ['src/**/*.js', 'src/**/*.jsx', 'src/**/*.tsx'], // Include .jsx and .tsx files
      exclude: ['test/**', '*.ts', 'src/frontend/src/components/*.tsx', 'src/frontend/**', 'src/tmp/**'],
      reportOnFailure: true,
    },
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
});