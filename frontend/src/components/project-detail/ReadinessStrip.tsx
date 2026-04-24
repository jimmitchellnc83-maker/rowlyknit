import type { ComponentType } from 'react';
import {
  FiBookOpen,
  FiRotateCw,
  FiLayers,
  FiTool,
  FiGrid,
  FiEdit3,
} from 'react-icons/fi';
import type { NeedleCheckPayload } from './sidebar';

type Status = 'ready' | 'missing' | 'conflict' | 'optional';

interface ChipConfig {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  status: Status;
  detail: string;
  onClick: () => void;
}

interface ReadinessStripProps {
  patterns: { id: string; [k: string]: unknown }[];
  counters: { id: string; [k: string]: unknown }[];
  yarn: { id: string; [k: string]: unknown }[];
  tools: { id: string; [k: string]: unknown }[];
  pieces?: { id: string; [k: string]: unknown }[];
  notes?: string | null;
  needleCheck?: NeedleCheckPayload | null;
  onAddPattern: () => void;
  onAddYarn: () => void;
  onAddTool: () => void;
  onFocusNotes?: () => void;
}

const STATUS_STYLES: Record<Status, { dot: string; border: string; hint: string }> = {
  ready: {
    dot: 'bg-green-500',
    border: 'border-green-200 dark:border-green-800/60 hover:border-green-300 dark:hover:border-green-700',
    hint: 'text-green-700 dark:text-green-300',
  },
  missing: {
    dot: 'bg-gray-300 dark:bg-gray-600',
    border: 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700',
    hint: 'text-gray-500 dark:text-gray-400',
  },
  conflict: {
    dot: 'bg-red-500',
    border: 'border-red-200 dark:border-red-800/60 hover:border-red-300 dark:hover:border-red-700',
    hint: 'text-red-700 dark:text-red-300',
  },
  optional: {
    dot: 'bg-gray-200 dark:bg-gray-700',
    border: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
    hint: 'text-gray-500 dark:text-gray-400',
  },
};

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildChips(props: ReadinessStripProps): ChipConfig[] {
  const {
    patterns,
    counters,
    yarn,
    tools,
    pieces,
    notes,
    needleCheck,
    onAddPattern,
    onAddYarn,
    onAddTool,
    onFocusNotes,
  } = props;

  const trimmedNotes = (notes ?? '').trim();
  const pieceCount = pieces?.length ?? 0;

  const toolsStatus: Status =
    needleCheck?.status === 'red'
      ? 'conflict'
      : tools.length > 0
      ? 'ready'
      : 'optional';

  const toolsDetail =
    needleCheck?.status === 'red'
      ? `Missing ${needleCheck.missingSizesMm.length} size(s)`
      : tools.length > 0
      ? `${tools.length} tool${tools.length === 1 ? '' : 's'} assigned`
      : 'Tag the needles you\'re using';

  return [
    {
      key: 'pattern',
      label: 'Pattern',
      icon: FiBookOpen,
      status: patterns.length > 0 ? 'ready' : 'missing',
      detail:
        patterns.length > 0
          ? `${patterns.length} attached`
          : 'Attach the pattern you\'re following',
      onClick:
        patterns.length > 0 ? () => scrollToSection('section-patterns') : onAddPattern,
    },
    {
      key: 'counter',
      label: 'Counter',
      icon: FiRotateCw,
      status: counters.length > 0 ? 'ready' : 'missing',
      detail:
        counters.length > 0
          ? `${counters.length} active`
          : 'Add one to unlock Knitting Mode',
      onClick: () => scrollToSection('section-counters'),
    },
    {
      key: 'yarn',
      label: 'Yarn',
      icon: FiLayers,
      status: yarn.length > 0 ? 'ready' : 'missing',
      detail:
        yarn.length > 0
          ? `${yarn.length} assigned`
          : 'Assign yarn to check feasibility',
      onClick: yarn.length > 0 ? () => scrollToSection('section-yarn') : onAddYarn,
    },
    {
      key: 'tools',
      label: 'Tools',
      icon: FiTool,
      status: toolsStatus,
      detail: toolsDetail,
      onClick: tools.length > 0 ? () => scrollToSection('section-tools') : onAddTool,
    },
    {
      key: 'pieces',
      label: 'Pieces',
      icon: FiGrid,
      status: pieceCount > 0 ? 'ready' : 'optional',
      detail:
        pieceCount > 0
          ? `${pieceCount} piece${pieceCount === 1 ? '' : 's'} tracked`
          : 'Break out panels for garments',
      onClick: () => scrollToSection('section-pieces'),
    },
    {
      key: 'notes',
      label: 'Notes',
      icon: FiEdit3,
      status: trimmedNotes.length > 0 ? 'ready' : 'optional',
      detail:
        trimmedNotes.length > 0
          ? 'Notes started'
          : 'Jot setup decisions and mods',
      onClick: onFocusNotes ?? (() => scrollToSection('section-notes')),
    },
  ];
}

/**
 * Horizontal readiness strip shown above the fold on ProjectDetail. Each
 * chip surfaces one dimension of "is this project set up enough to knit
 * productively?" and, when clicked, jumps to the relevant section or opens
 * the add-modal for that dimension. Derives entirely from existing project
 * data — no schema changes.
 */
export default function ReadinessStrip(props: ReadinessStripProps) {
  const chips = buildChips(props);

  return (
    <div
      className="mb-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      aria-label="Project readiness"
    >
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const styles = STATUS_STYLES[chip.status];
          const Icon = chip.icon;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClick}
              className={`group flex min-w-[140px] flex-1 items-center gap-2 rounded-md border bg-gray-50 px-3 py-2 text-left transition dark:bg-gray-900/40 ${styles.border}`}
              aria-label={`${chip.label}: ${chip.detail}`}
              title={chip.detail}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
                aria-hidden="true"
              />
              <Icon className="h-4 w-4 shrink-0 text-gray-600 dark:text-gray-300" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {chip.label}
                </span>
                <span className={`truncate text-xs ${styles.hint}`}>
                  {chip.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
