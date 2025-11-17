import axios, { AxiosError, AxiosRequestConfig } from 'axios';

/**
 * Enhanced Axios Configuration
 * - CSRF token handling
 * - Request/response interceptors
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - Development logging
 */

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000, // 30 seconds
  withCredentials: true, // Enable cookies for session/CSRF
  headers: {
    'Content-Type': 'application/json',
  },
});

// CSRF token cache
let csrfToken: string | null = null;

/**
 * Fetch CSRF token from backend
 */
async function fetchCsrfToken(): Promise<string> {
  try {
    const response = await axios.get('/api/csrf-token', {
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      withCredentials: true,
    });
    csrfToken = response.data.csrfToken;
    return csrfToken || '';
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    throw error;
  }
}

/**
 * Get cached CSRF token or fetch new one
 */
async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }
  return fetchCsrfToken();
}

/**
 * Request Interceptor
 * - Add CSRF token to unsafe methods (POST, PUT, DELETE, PATCH)
 * - Log requests in development
 */
apiClient.interceptors.request.use(
  async (config) => {
    // Add CSRF token for unsafe methods
    const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (config.method && unsafeMethods.includes(config.method.toUpperCase())) {
      try {
        const token = await getCsrfToken();
        if (!config.headers) {
          config.headers = {} as any;
        }
        config.headers['x-csrf-token'] = token;
      } catch (error) {
        console.error('Failed to attach CSRF token:', error);
      }
    }

    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('[API Request Error]', error);
    }
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * - Handle common HTTP errors
 * - Retry failed requests
 * - Log responses in development
 * - Handle CSRF token expiration
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

    // Log errors in development
    if (import.meta.env.DEV) {
      console.error('[API Error]', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    }

    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      // Clear CSRF token
      csrfToken = null;

      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Handle 403 Forbidden - might be CSRF token issue
    if (error.response?.status === 403) {
      const errorData = error.response.data as { error?: string };

      // If CSRF error, refresh token and retry once
      if (errorData.error?.includes('CSRF') && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          // Fetch new CSRF token
          await fetchCsrfToken();

          // Retry original request with new token
          return apiClient(originalRequest);
        } catch (retryError) {
          console.error('Failed to retry request after CSRF refresh:', retryError);
          return Promise.reject(error);
        }
      }
    }

    // Handle network errors with retry logic
    if (!error.response && originalRequest) {
      const maxRetries = 3;
      const retryCount = originalRequest._retryCount || 0;

      if (retryCount < maxRetries) {
        originalRequest._retryCount = retryCount + 1;

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;

        if (import.meta.env.DEV) {
          console.log(`[API Retry] Attempt ${retryCount + 1}/${maxRetries} after ${delay}ms`);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        return apiClient(originalRequest);
      }
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      console.warn('Resource not found:', originalRequest?.url);
    }

    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn('Rate limit exceeded. Retry after:', retryAfter);
    }

    // Handle 500 Internal Server Error
    if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
    }

    // Handle 503 Service Unavailable
    if (error.response?.status === 503) {
      console.error('Service unavailable. Server might be down.');
    }

    return Promise.reject(error);
  }
);

/**
 * Helper function to clear CSRF token
 * Useful when user logs out
 */
export function clearCsrfToken(): void {
  csrfToken = null;
}

/**
 * Helper function to manually refresh CSRF token
 */
export async function refreshCsrfToken(): Promise<string> {
  return fetchCsrfToken();
}

export default apiClient;
