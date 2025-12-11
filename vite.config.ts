import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'robots.txt', 'public/贵蓁LOGO峄山碑篆体.jpg'],
          manifest: {
            name: '贵蓁供销存系统',
            short_name: '贵蓁CRM',
            description: '贵蓁供销存 - 专业的供应链管理系统',
            theme_color: '#3b82f6',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait-primary',
            scope: '/',
            start_url: '/',
            icons: [
              {
                src: '/贵蓁LOGO峄山碑篆体.jpg',
                sizes: '192x192',
                type: 'image/jpeg',
                purpose: 'any'
              },
              {
                src: '/贵蓁LOGO峄山碑篆体.jpg',
                sizes: '512x512',
                type: 'image/jpeg',
                purpose: 'any'
              },
              {
                src: '/贵蓁LOGO峄山碑篆体.jpg',
                sizes: '192x192',
                type: 'image/jpeg',
                purpose: 'maskable'
              }
            ],
            screenshots: [
              {
                src: '/贵蓁LOGO峄山碑篆体.jpg',
                sizes: '192x192',
                type: 'image/jpeg',
                form_factor: 'narrow'
              },
              {
                src: '/贵蓁LOGO峄山碑篆体.jpg',
                sizes: '512x512',
                type: 'image/jpeg',
                form_factor: 'wide'
              }
            ],
            categories: ['business', 'productivity']
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'cdn-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  }
                }
              },
              {
                urlPattern: /^https:\/\/api\./,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'api-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 5
                  }
                }
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
