import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageview } from '../lib/analytics';

// Fires a Plausible pageview on every client-side navigation. The script
// itself only counts the initial load, so SPAs need this to track route
// changes.
export function usePageviews(): void {
  const location = useLocation();

  useEffect(() => {
    trackPageview();
  }, [location.pathname]);
}
