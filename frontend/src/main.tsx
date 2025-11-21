import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { WebSocketProvider } from './contexts/WebSocketContext';
import './lib/axios'; // Initialize axios configuration with withCredentials
import './styles/index.css';
import 'react-toastify/dist/ReactToastify.css';

// Global error handlers for debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  console.error('Error message:', event.message);
  console.error('Error source:', event.filename, event.lineno, event.colno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Global API error handler - shows toast notifications for API errors
window.addEventListener('api-error', ((event: CustomEvent<{ status: number; message: string }>) => {
  const { status, message } = event.detail;
  // Only show toast for certain errors (not 404s for resources that might not exist)
  if (status >= 500) {
    toast.error(message);
  } else if (status === 422) {
    toast.warning(message);
  }
}) as EventListener);

// Rate limit exceeded handler
window.addEventListener('rate-limit-exceeded', ((event: CustomEvent<{ message: string; retryAfter?: number }>) => {
  const { message, retryAfter } = event.detail;
  toast.warning(`${message}${retryAfter ? ` Please wait ${retryAfter} seconds.` : ''}`, {
    autoClose: retryAfter ? retryAfter * 1000 : 5000,
  });
}) as EventListener);

// IMPORTANT: Unregister old service workers and clear cache to fix React undefined issue
// This ensures we don't serve stale JS bundles from the service worker cache
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      // Get all service worker registrations
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Unregister all existing service workers
      for (const registration of registrations) {
        console.log('Unregistering old service worker...');
        await registration.unregister();
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          console.log('Deleting cache:', cacheName);
          await caches.delete(cacheName);
        }
      }

      console.log('✅ All service workers unregistered and caches cleared');

      // Now register the new service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ New ServiceWorker registered:', registration);
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

  console.log('Initializing React app...');
  console.log('React version:', React.version);
  console.log('Environment:', import.meta.env.MODE);

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

  console.log('✅ React app initialized successfully');
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
