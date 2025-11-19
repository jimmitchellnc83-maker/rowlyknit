import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
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

// Register service worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('ServiceWorker registered:', registration);
      },
      (error) => {
        console.log('ServiceWorker registration failed:', error);
      }
    );
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
