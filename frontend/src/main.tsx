import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import * as Sentry from '@sentry/react';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { WebSocketProvider } from './contexts/WebSocketContext';
import './lib/axios'; // Initialize axios configuration with withCredentials
import './styles/index.css';
import 'react-toastify/dist/ReactToastify.css';

// Initialize Sentry (before anything else)
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}

// Global error handlers for debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  console.error('Error message:', event.message);
  console.error('Error source:', event.filename, event.lineno, event.colno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// IMPORTANT: Unregister old service workers and clear cache to fix React undefined issue
// This ensures we don't serve stale JS bundles from the service worker cache
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      // Get all service worker registrations
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Unregister all existing service workers
      for (const registration of registrations) {
        await registration.unregister();
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }


      // Now register the new service worker
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.error('❌ ServiceWorker error:', error);
    }
  });
}

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Add error logging to catch initialization errors
try {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element not found! DOM might not be ready.');
  }


  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <WebSocketProvider>
              <App />
              <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
              />
            </WebSocketProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );

} catch (error) {
  console.error('❌ Failed to initialize React app:', error);

  // Display error to user
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto;">
        <h1 style="color: #dc2626;">Application Error</h1>
        <p>The application failed to start. Please check the browser console for details.</p>
        <pre style="background: #f3f4f6; padding: 15px; border-radius: 5px; overflow: auto;">
          ${error instanceof Error ? error.message : String(error)}
          ${error instanceof Error && error.stack ? '\n\n' + error.stack : ''}
        </pre>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #8b5cf6; color: white; border: none; border-radius: 5px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
  }
}
