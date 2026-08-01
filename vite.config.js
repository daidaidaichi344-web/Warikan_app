import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'わりかん帳',
        short_name: 'わりかん帳',
        description: 'ふたりの支出を割り勘・精算管理するアプリ',
        theme_color: '#3E6B5C',
        background_color: '#FAF6EC',
        display: 'standalone',
        start_url: '/'
      }
    })
  ]
});
