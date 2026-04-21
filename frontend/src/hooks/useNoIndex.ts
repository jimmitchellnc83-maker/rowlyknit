import { useEffect } from 'react';

/**
 * Injects a `<meta name="robots" content="noindex, nofollow">` into the page
 * head while the calling component is mounted. Use on auth pages (/login,
 * /register, /forgot-password, /reset-password) so search engines don't index
 * them.
 */
export function useNoIndex() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);
}
