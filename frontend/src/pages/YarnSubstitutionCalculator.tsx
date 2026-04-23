import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiPackage,
} from 'react-icons/fi';
import LoadingSpinner from '../components/LoadingSpinner';

// Mirror of the backend types for the yarn-substitution endpoint response.
type LightLevel = 'green' | 'yellow' | 'red';
type DimLevel = LightLevel | 'unknown';

interface YarnMatchCandidate {
  yarnId: string;
  name: string;
  brand: string | null;
  weight: string | null;
  fiberContent: string | null;
  yardsRemaining: number | null;
  dyeLot: string | null;
  color: string | null;
  score: number;
  level: LightLevel;
  weightLevel: DimLevel;
  yardageLevel: DimLevel;
  fiberLevel: DimLevel;
  reasons: string[];
}

interface SubstitutionResult {
  status: LightLevel;
  requirement: {
    weightName: string | null;
    weightNumber: number | null;
    fiberHints: string[];
    totalYardage: number | null;
    skeinCount: number | null;
  };
  bestCandidate: YarnMatchCandidate | null;
  candidates: YarnMatchCandidate[];
  message: string;
}

// The API normalises weight names (backend accepts 'fingering', 'DK',
// etc. as aliases of the CYC canonical names), but we keep the value
// field as the CYC canonical so the request payload stays stable. Only
// the visible label changes — showing the knitter vernacular first
// because that's how labels are printed in the real world. Matches the
// Yarn Stash add/edit form which already uses these names.
const WEIGHT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Lace', label: 'Lace' },
  { value: 'Super Fine', label: 'Fingering / Sock (Super Fine)' },
  { value: 'Fine', label: 'Sport (Fine)' },
  { value: 'Light', label: 'DK (Light)' },
  { value: 'Medium', label: 'Worsted / Aran (Medium)' },
  { value: 'Bulky', label: 'Chunky / Bulky' },
  { value: 'Super Bulky', label: 'Super Bulky' },
  { value: 'Jumbo', label: 'Jumbo' },
];

const FIBER_OPTIONS = [
  'wool',
  'merino',
  'alpaca',
  'silk',
  'cashmere',
  'cotton',
  'linen',
  'bamboo',
  'acrylic',
  'nylon',
  'polyester',
] as const;

const statusIcon: Record<LightLevel, React.ElementType> = {
  green: FiCheckCircle,
  yellow: FiAlertTriangle,
  red: FiXCircle,
};

const statusBg: Record<LightLevel, string> = {
  green: 'bg-green-50 border-green-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  red: 'bg-red-50 border-red-200',
};

const statusColor: Record<LightLevel, string> = {
  green: 'text-green-700',
  yellow: 'text-yellow-700',
  red: 'text-red-700',
};

function StatusPill({ level }: { level: LightLevel }) {
  const Icon = statusIcon[level];
  const label = level === 'green' ? 'Great match' : level === 'yellow' ? 'Substitutable' : 'Poor fit';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusBg[level]} ${statusColor[level]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function CandidateCard({ candidate }: { candidate: YarnMatchCandidate }) {
  const yardageLabel =
    candidate.yardsRemaining != null ? `${candidate.yardsRemaining} yds left` : 'yardage unknown';
  const dims = [candidate.weight, candidate.fiberContent, candidate.color]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className={`rounded-lg border p-3 ${statusBg[candidate.level]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/yarn/${candidate.yarnId}`}
            className="font-medium text-gray-900 hover:text-purple-600"
          >
            {candidate.name}
          </Link>
          {candidate.brand ? <p className="text-xs text-gray-500">{candidate.brand}</p> : null}
          {dims ? <p className="mt-1 text-sm text-gray-700">{dims}</p> : null}
          <p className="text-xs text-gray-500">{yardageLabel}</p>
        </div>
        <StatusPill level={candidate.level} />
      </div>
      {candidate.reasons.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
          {candidate.reasons.map((reason, idx) => (
            <li key={idx}>· {reason}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

type NumField = number | '';

export default function YarnSubstitutionCalculator() {
  const [weightName, setWeightName] = useState<string>('');
  const [selectedFibers, setSelectedFibers] = useState<Set<string>>(new Set());
  const [yardage, setYardage] = useState<NumField>('');
  const [skeinCount, setSkeinCount] = useState<NumField>('');

  const mutation = useMutation<SubstitutionResult, unknown, void>({
    mutationFn: async () => {
      const res = await axios.post('/api/yarn/substitutions', {
        weightName: weightName || null,
        fiberHints: selectedFibers.size > 0 ? Array.from(selectedFibers) : null,
        yardage: typeof yardage === 'number' ? yardage : null,
        skeinCount: typeof skeinCount === 'number' ? skeinCount : null,
      });
      return res.data.data.substitution as SubstitutionResult;
    },
  });

  const result = mutation.data ?? null;
  const others = result
    ? result.candidates.filter((c) => c.yarnId !== result.bestCandidate?.yarnId)
    : [];

  const toggleFiber = (fiber: string) => {
    setSelectedFibers((prev) => {
      const next = new Set(prev);
      if (next.has(fiber)) next.delete(fiber);
      else next.add(fiber);
      return next;
    });
  };

  const canSearch =
    weightName !== '' ||
    selectedFibers.size > 0 ||
    (typeof yardage === 'number' && yardage > 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link
          to="/calculators"
          className="inline-flex items-center text-purple-600 hover:text-purple-700"
        >
          <FiArrowLeft className="mr-2 h-4 w-4" />
          Back to Calculators
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
          Yarn Substitution Calculator
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Describe the yarn a pattern calls for, and we&apos;ll rank your stash by how well each
          option could stand in for it — weight, fiber, and yardage all scored.
        </p>
      </div>

      <form
        className="space-y-4 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Weight
            </span>
            <select
              value={weightName}
              onChange={(e) => setWeightName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Any weight</option>
              {WEIGHT_OPTIONS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Yardage needed
            </span>
            <input
              type="number"
              value={yardage === '' ? '' : String(yardage)}
              min={0}
              step={50}
              onChange={(e) => {
                const v = e.target.value;
                setYardage(v === '' ? '' : parseFloat(v) || '');
              }}
              placeholder="e.g. 800"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Skeins (optional)
            </span>
            <input
              type="number"
              value={skeinCount === '' ? '' : String(skeinCount)}
              min={0}
              step={1}
              onChange={(e) => {
                const v = e.target.value;
                setSkeinCount(v === '' ? '' : parseInt(v, 10) || '');
              }}
              placeholder="e.g. 4"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
        </div>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Fiber content (select any that apply)
          </legend>
          <div className="flex flex-wrap gap-2">
            {FIBER_OPTIONS.map((fiber) => {
              const active = selectedFibers.has(fiber);
              return (
                <button
                  key={fiber}
                  type="button"
                  onClick={() => toggleFiber(fiber)}
                  className={`rounded-full border px-3 py-1 text-sm capitalize transition ${
                    active
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {fiber}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={!canSearch || mutation.isPending}
            className="rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {mutation.isPending ? 'Searching…' : 'Find substitutes'}
          </button>
        </div>
      </form>

      {mutation.isPending ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner text="Scoring your stash…" />
        </div>
      ) : null}

      {mutation.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load substitutions. Please try again.
        </div>
      ) : null}

      {result ? (
        <section className="space-y-4">
          <div className={`flex items-start gap-4 rounded-lg border p-4 ${statusBg[result.status]}`}>
            <FiPackage className={`h-10 w-10 flex-shrink-0 ${statusColor[result.status]}`} />
            <div>
              <h2 className={`text-xl font-semibold ${statusColor[result.status]}`}>
                {result.status === 'green'
                  ? 'Strong match in your stash'
                  : result.status === 'yellow'
                    ? 'Possible substitutes'
                    : 'Nothing in your stash will work'}
              </h2>
              <p className="mt-1 text-sm text-gray-700">{result.message}</p>
            </div>
          </div>

          {result.bestCandidate ? (
            <div>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                Best match
              </h3>
              <CandidateCard candidate={result.bestCandidate} />
            </div>
          ) : null}

          {others.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                Other candidates ({others.length})
              </h3>
              <div className="space-y-3">
                {others.map((c) => (
                  <CandidateCard key={c.yarnId} candidate={c} />
                ))}
              </div>
            </div>
          ) : null}

          {result.status === 'red' && !result.bestCandidate ? (
            <p className="text-sm italic text-gray-500">
              Your stash is empty, or nothing comes close enough to substitute. Try loosening the
              criteria (for example, deselect specific fibers) or head to a yarn shop.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
