import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  FiTrash2,
  FiRefreshCw,
  FiCompass,
  FiAlertTriangle,
  FiTarget,
} from 'react-icons/fi';
import { formatDate } from '../../utils/formatDate';

type OnboardingGoal =
  | 'track_project'
  | 'organize_stash'
  | 'follow_pattern'
  | 'design_new'
  | 'explore_examples';

const GOAL_LABEL: Record<OnboardingGoal, string> = {
  track_project: 'Track my current project',
  organize_stash: 'Organize yarn, tools, and supplies',
  follow_pattern: 'Follow a pattern step by step',
  design_new: 'Design a pattern or garment',
  explore_examples: 'Show me how Rowly works',
};

interface ExampleStatus {
  total: number;
  breakdown: {
    yarns: number;
    tools: number;
    patterns: number;
    recipients: number;
    projects: number;
  };
  seededAt: string | null;
  clearedAt: string | null;
  tourCompletedAt: string | null;
  onboardingGoal: OnboardingGoal | null;
}

/**
 * "Getting started" tab in Profile. Two controls:
 *
 * 1. **Clear example data** — nukes every row tagged is_example=true for
 *    the user. Shown with a live count; hides itself once total hits 0.
 *    Double-confirm because this is destructive.
 * 2. **Restart guided tour** — sets tour_completed_at back to null so the
 *    tour fires again on the next Dashboard visit. (Once the tour UI is
 *    wired in.)
 */
export default function OnboardingTab() {
  const [status, setStatus] = useState<ExampleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [resettingTour, setResettingTour] = useState(false);
  const [resettingGoal, setResettingGoal] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/users/me/examples');
      setStatus(res.data.data);
    } catch {
      toast.error('Could not load onboarding status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const clearExamples = async () => {
    setClearing(true);
    try {
      const res = await axios.delete('/api/users/me/examples');
      const n = Object.values(res.data.data.deleted as Record<string, number>)
        .reduce((a, b) => a + b, 0);
      toast.success(`Cleared ${n} example item${n === 1 ? '' : 's'}.`);
      setConfirmingClear(false);
      await fetchStatus();
    } catch {
      toast.error('Could not clear example data');
    } finally {
      setClearing(false);
    }
  };

  const restartTour = async () => {
    setResettingTour(true);
    try {
      await axios.put('/api/users/me/tour', { completed: false });
      toast.success('Tour reset — it will start next time you visit the Dashboard.');
      await fetchStatus();
    } catch {
      toast.error('Could not reset the tour');
    } finally {
      setResettingTour(false);
    }
  };

  const resetGoal = async () => {
    setResettingGoal(true);
    try {
      await axios.put('/api/users/me/onboarding-goal', { goal: null });
      toast.success('Goal cleared — the goal-pick card will show on your next Dashboard visit.');
      await fetchStatus();
    } catch {
      toast.error('Could not reset the goal');
    } finally {
      setResettingGoal(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }
  if (!status) return null;

  const hasExamples = status.total > 0;
  const { breakdown } = status;

  return (
    <div className="space-y-4">
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex-shrink-0">
            <FiCompass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Example data
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              When you signed up, Rowly seeded a showcase project, some yarn, a
              couple patterns, and tools so you could see how everything works.
              Clear them when you're ready to work with your own data.
            </p>
          </div>
        </div>

        {hasExamples ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 text-sm">
              <StatTile label="Projects" value={breakdown.projects} />
              <StatTile label="Yarn" value={breakdown.yarns} />
              <StatTile label="Patterns" value={breakdown.patterns} />
              <StatTile label="Tools" value={breakdown.tools} />
              <StatTile label="Recipients" value={breakdown.recipients} />
              <StatTile
                label="Total"
                value={status.total}
                highlight
              />
            </div>

            {!confirmingClear ? (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 font-medium text-sm"
              >
                <FiTrash2 className="w-4 h-4" />
                Clear {status.total} example item{status.total === 1 ? '' : 's'}
              </button>
            ) : (
              <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <FiAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-900 dark:text-red-200">
                    <p className="font-semibold mb-1">Clear every example item?</p>
                    <p>
                      This deletes {status.total} root items — everything attached
                      (counters, panels, sessions, markers, ratings) is removed too.
                      Your own projects, yarn, patterns, and tools are <b>not</b>{' '}
                      touched. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    disabled={clearing}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    Keep them
                  </button>
                  <button
                    type="button"
                    onClick={clearExamples}
                    disabled={clearing}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium disabled:opacity-50"
                  >
                    {clearing ? 'Clearing…' : 'Yes, clear everything'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All example data has been cleared. Any projects, yarn, patterns, and
            tools you see now are yours.
          </p>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex-shrink-0">
            <FiRefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Guided tour
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {status.tourCompletedAt
                ? `You finished the tour on ${formatDate(status.tourCompletedAt)}. Reset it and it'll start again on the Dashboard.`
                : 'The tour will start the next time you open the Dashboard.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={restartTour}
          disabled={resettingTour}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 font-medium text-sm disabled:opacity-50"
        >
          <FiRefreshCw className="w-4 h-4" />
          {resettingTour ? 'Resetting…' : 'Restart the tour'}
        </button>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex-shrink-0">
            <FiTarget className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              First-visit goal
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {status.onboardingGoal
                ? <>You picked <b>{GOAL_LABEL[status.onboardingGoal]}</b>. Reset it to see the goal-pick card again on the Dashboard.</>
                : 'You haven\'t picked a goal yet — the card will show on your next Dashboard visit.'}
            </p>
          </div>
        </div>
        {status.onboardingGoal && (
          <button
            type="button"
            onClick={resetGoal}
            disabled={resettingGoal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950/50 font-medium text-sm disabled:opacity-50"
          >
            <FiRefreshCw className="w-4 h-4" />
            {resettingGoal ? 'Clearing…' : 'Clear goal'}
          </button>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        highlight
          ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900'
          : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`text-2xl font-semibold tabular-nums ${
          highlight
            ? 'text-purple-700 dark:text-purple-300'
            : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
