/**
 * Retry utilities for handling failed API requests with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  onRetry: () => {},
};

/**
 * Retry a function with exponential backoff
 * @param fn The async function to retry
 * @param options Retry configuration options
 * @returns Promise resolving to the function's return value
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Don't retry on client errors (4xx)
      if (isClientError(error)) {
        throw error;
      }

      // Call the retry callback
      opts.onRetry(lastError, attempt + 1);

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Check if error is a client error (4xx) that shouldn't be retried
 */
function isClientError(error: any): boolean {
  if (error?.response?.status) {
    const status = error.response.status;
    return status >= 400 && status < 500;
  }
  return false;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for axios requests with toast notifications
 */
export async function retryAxiosRequest<T>(
  requestFn: () => Promise<T>,
  operationName: string = 'operation',
  showToast: (message: string, type: 'info' | 'error') => void = () => {}
): Promise<T> {
  return retryWithBackoff(requestFn, {
    maxRetries: 3,
    initialDelay: 1000,
    onRetry: (error, attempt) => {
      console.warn(`Retrying ${operationName} (attempt ${attempt})`, error);
      if (attempt === 1) {
        showToast(`Network issue detected. Retrying ${operationName}...`, 'info');
      }
    },
  });
}

/**
 * Retry utility specifically for file uploads with progress tracking
 */
export async function retryFileUpload<T>(
  uploadFn: () => Promise<T>,
  fileName: string,
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<T> {
  return retryWithBackoff(uploadFn, {
    maxRetries: 3,
    initialDelay: 2000, // Longer initial delay for uploads
    maxDelay: 15000,
    onRetry: (error, attempt) => {
      console.warn(`Retrying upload for ${fileName} (attempt ${attempt})`, error);
      onProgress?.(attempt, 3);
    },
  });
}

/**
 * Check if the device is online before attempting operation
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Wait for online status before executing function
 */
export async function waitForOnline(
  timeout: number = 30000
): Promise<boolean> {
  if (isOnline()) {
    return true;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', onlineHandler);
      resolve(false);
    }, timeout);

    const onlineHandler = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', onlineHandler);
      resolve(true);
    };

    window.addEventListener('online', onlineHandler);
  });
}
