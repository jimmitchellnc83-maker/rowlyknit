import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Joyride, {
  ACTIONS,
  EVENTS,
  STATUS,
  type CallBackProps,
  type Step,
} from 'react-joyride';
import axios from 'axios';
import { useAuthStore } from '../../stores/authStore';

/**
 * First-run guided tour for new accounts.
 *
 * Auto-starts when:
 *   - User is authenticated
 *   - Dashboard is the current route
 *   - Backend reports `tour_completed_at === null`
 *
 * On finish/skip, PUTs tour_completed_at so the tour doesn't fire again
 * until the user explicitly restarts it from Profile → Getting started.
 *
 * Deliberately single-page: we don't chain across routes because
 * Joyride targets fail when the anchored element doesn't exist. Instead
 * the last step points users at Profile → Getting started for next steps.
 */
export default function GuidedTour() {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState(false);

  // Only auto-start on /dashboard.
  const onDashboard = location.pathname === '/dashboard';

  // Ask the backend whether the tour should run, once per session.
  useEffect(() => {
    if (!isAuthenticated || !onDashboard || checked) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get('/api/users/me/examples');
        if (cancelled) return;
        const done: string | null = res.data?.data?.tourCompletedAt ?? null;
        setRun(!done);
      } catch {
        // Fail quiet — not being able to load is not worth bothering the user.
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, onDashboard, checked]);

  // Reset check when user changes (logout/login).
  useEffect(() => {
    setChecked(false);
    setRun(false);
    setStepIndex(0);
  }, [user?.id]);

  const markComplete = useCallback(async () => {
    try {
      await axios.put('/api/users/me/tour', { completed: true });
    } catch {
      // Non-critical — the worst case is the tour re-fires. We can live with that.
    }
  }, []);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, index, action } = data;
      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        setStepIndex(action === ACTIONS.PREV ? index - 1 : index + 1);
      }
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        setRun(false);
        setStepIndex(0);
        void markComplete();
      }
    },
    [markComplete],
  );

  if (!run) return null;

  return (
    <Joyride
      steps={STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      scrollToFirstStep
      callback={handleCallback}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
      styles={{
        options: {
          primaryColor: '#7C3AED',
          zIndex: 10000,
          arrowColor: '#fff',
          backgroundColor: '#fff',
          textColor: '#111827',
          overlayColor: 'rgba(17, 24, 39, 0.6)',
        },
        buttonNext: {
          backgroundColor: '#7C3AED',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 14,
          fontWeight: 600,
        },
        buttonBack: { color: '#6B7280', fontSize: 13 },
        buttonSkip: { color: '#6B7280', fontSize: 13 },
        tooltip: { borderRadius: 10, padding: 16 },
        tooltipTitle: { fontSize: 16, fontWeight: 600, marginBottom: 6 },
        tooltipContent: { fontSize: 14, lineHeight: 1.5, padding: 0 },
      }}
    />
  );
}

const STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Welcome to Rowly',
    content:
      "Quick 60-second tour. We've pre-loaded a showcase project, some yarn, a few patterns, and tools so every page has real content to play with. Clear the examples anytime from Profile.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="quick-create"]',
    placement: 'left',
    title: 'Quick-create',
    content:
      'Tap this + button from any page (or press C) to add a project, yarn, pattern, or tool in 1–3 fields. No menu-diving.',
  },
  {
    target: '[data-tour="page-help"]',
    placement: 'left',
    title: 'Contextual help',
    content:
      'The ? button is on every page. It opens a step-by-step how-to for each tool on whatever page you\'re looking at.',
  },
  {
    target: 'body',
    placement: 'center',
    title: 'Explore the examples',
    content:
      "Open the Harvest Pullover project to see everything wired up — counters, Panel Mode, magic markers, sessions. Then check out the yarn stash, patterns library, and calculators from the nav. The ? button on each page walks you through what's there.",
    disableBeacon: true,
  },
  {
    target: 'body',
    placement: 'center',
    title: 'Ready to work for real?',
    content:
      "When the examples have outlived their welcome, head to Profile → Getting started and tap Clear example data. Your own content is never touched. You can restart this tour from the same place.",
    disableBeacon: true,
  },
];
