import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// This folder lives inside the Yii repo as `frontend/`:
//   focus-party-backend/
//   ├── controllers/ models/ migrations/ ...
//   ├── web/        ← `npm run build` puts the React app here, next to Yii's index.php
//   └── frontend/   ← this project
export default defineConfig({
  plugins: [react()],
  server: {
    // dev: requests to /api go to Yii running on this machine
    // (php yii serve --port=8080, or php -S localhost:8080 -t web)
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: '../web',
    emptyOutDir: false, // never wipe Yii's index.php / .htaccess
    assetsDir: 'app', // web/assets is already used by Yii
  },
})
