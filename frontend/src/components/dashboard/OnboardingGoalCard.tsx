import { ComponentType } from 'react';
import { FiFolder, FiPackage, FiBookOpen, FiTool, FiCompass, FiArrowRight } from 'react-icons/fi';

export type OnboardingGoal =
  | 'track_project'
  | 'organize_stash'
  | 'follow_pattern'
  | 'design_new'
  | 'explore_examples';

interface GoalOption {
  goal: OnboardingGoal;
  title: string;
  body: string;
  icon: ComponentType<{ className?: string }>;
}

const OPTIONS: GoalOption[] = [
  {
    goal: 'track_project',
    title: 'Track an active project',
    body: 'Log row counts, attach yarn, snap photos — for a project you have on the needles right now.',
    icon: FiFolder,
  },
  {
    goal: 'organize_stash',
    title: 'Organize my stash',
    body: 'Inventory yarn so feasibility, substitutions, and project planning all pull from what you actually own.',
    icon: FiPackage,
  },
  {
    goal: 'follow_pattern',
    title: 'Follow a pattern without losing my place',
    body: 'Upload a PDF or paste from the web. Knitting Mode keeps you on the active row.',
    icon: FiBookOpen,
  },
  {
    goal: 'design_new',
    title: 'Design something new',
    body: 'Parametric Designer turns your gauge + measurements into cast-on numbers and a schematic.',
    icon: FiTool,
  },
  {
    goal: 'explore_examples',
    title: 'Explore with example data',
    body: 'Poke around the seeded showcase before you bring in real projects. Clear it any time.',
    icon: FiCompass,
  },
];

interface Props {
  onSelect: (goal: OnboardingGoal) => void;
  onSkip: () => void;
  saving?: boolean;
}

/**
 * First-Dashboard-visit card asking new registrants what they want to do
 * first. The choice is persisted to `users.onboarding_goal` and the user is
 * routed to the goal-appropriate flow. Skipping defaults to `track_project`
 * at the call site (per spec) so we don't reshow the card.
 */
export default function OnboardingGoalCard({ onSelect, onSkip, saving = false }: Props) {
  return (
    <section
      aria-labelledby="onboarding-goal-heading"
      className="mb-8 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/40 dark:bg-gray-800 md:p-8"
    >
      <h2
        id="onboarding-goal-heading"
        className="text-2xl font-bold text-gray-900 dark:text-gray-100"
      >
        What do you want to do first in Rowly?
      </h2>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Pick what fits — we'll send you to the right place. You can always come back to the rest.
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <li key={option.goal}>
              <button
                type="button"
                disabled={saving}
                onClick={() => onSelect(option.goal)}
                className="group flex h-full w-full items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-purple-300 hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-purple-700 dark:hover:bg-purple-900/20"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-gray-100">
                    {option.title}
                    <FiArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 text-purple-500 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                    />
                  </span>
                  <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
                    {option.body}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="text-sm font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline disabled:opacity-60 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Skip for now
        </button>
      </div>
    </section>
  );
}
