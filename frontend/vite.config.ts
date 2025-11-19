import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Plugin to inject build timestamp into HTML
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        return html.replace(
          'VITE_BUILD_TIMESTAMP',
          new Date().toISOString()
        );
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      // Clean up old caches on activation
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'Rowly - Knitting Project Manager',
        short_name: 'Rowly',
        description: 'The complete knitting project management app',
        theme_color: '#8b5cf6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Don't let service worker control JS/CSS - let browser handle these
        // This allows hard refreshes to work properly
        globPatterns: ['**/*.{html,ico,png,svg,webp}'],
        // Exclude JS/CSS from precaching to allow hard refresh to work
        globIgnores: ['**/*.js', '**/*.css'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          // DO NOT cache JS/CSS in service worker - let nginx/browser handle it
          // This ensures hard refresh (Ctrl+Shift+R) works properly
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /\.(?:js|css)$/],
        // Explicitly ignore JS and CSS files from all caching
        manifestTransforms: [
          (entries) => {
            // Filter out any JS or CSS files that might have been included
            const manifest = entries.filter(
              (entry) => !entry.url.endsWith('.js') && !entry.url.endsWith('.css')
            );
            return { manifest };
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate vendor chunks for better caching
          if (id.includes('node_modules')) {
            // React core libraries
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // PDF.js is large, split it separately
            if (id.includes('pdfjs-dist') || id.includes('react-pdf')) {
              return 'vendor-pdf';
            }
            // UI libraries
            if (id.includes('react-icons') || id.includes('react-toastify')) {
              return 'vendor-ui';
            }
            // Query and state management
            if (id.includes('@tanstack') || id.includes('zustand')) {
              return 'vendor-state';
            }
            // Utility libraries
            if (id.includes('date-fns') || id.includes('lodash') || id.includes('validator')) {
              return 'vendor-utils';
            }
            // Everything else from node_modules
            return 'vendor-other';
          }
        },
      },
    },
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
  },
});
