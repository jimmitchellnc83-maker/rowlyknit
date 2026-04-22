import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiShoppingCart,
  FiPackage,
  FiTool,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';

type LightLevel = 'green' | 'yellow' | 'red';
type DimLevel = LightLevel | 'unknown';

interface ParsedYarnRequirement {
  totalYardage: number | null;
  weightNumber: number | null;
  weightName: string | null;
  fiberHints: string[];
  skeinCount: number | null;
  rawText: string | null;
}

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

interface YarnRequirementResult {
  status: LightLevel;
  requirement: ParsedYarnRequirement;
  bestCandidate: YarnMatchCandidate | null;
  candidates: YarnMatchCandidate[];
  message: string;
}

interface ToolMatchItem {
  toolId: string;
  name: string;
  sizeMm: number | null;
  type: string;
  offsetMm: number;
}

interface ToolMatch {
  sizeMm: number;
  status: LightLevel;
  matches: ToolMatchItem[];
  message: string;
}

interface ToolRequirementResult {
  status: LightLevel;
  requirements: ToolMatch[];
  rawText: string | null;
}

interface ShoppingListItem {
  kind: 'yarn' | 'tool';
  description: string;
  reason: string;
}

interface FeasibilityReport {
  patternId: string;
  patternName: string;
  overallStatus: LightLevel;
  yarn: YarnRequirementResult;
  tools: ToolRequirementResult;
  shoppingList: ShoppingListItem[];
  generatedAt: string;
}

interface FeasibilityPanelProps {
  patternId: string;
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const statusIcon: Record<LightLevel, React.ElementType> = {
  green: FiCheckCircle,
  yellow: FiAlertTriangle,
  red: FiXCircle,
};

const statusText: Record<LightLevel, string> = {
  green: 'Ready',
  yellow: 'Substitutable',
  red: 'Missing',
};

const statusColor: Record<LightLevel, string> = {
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  red: 'text-red-600',
};

const statusBg: Record<LightLevel, string> = {
  green: 'bg-green-50 border-green-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  red: 'bg-red-50 border-red-200',
};

const overallHeadline: Record<LightLevel, { title: string; subtitle: string }> = {
  green: { title: 'Ready to cast on!', subtitle: 'Everything you need is in your stash.' },
  yellow: {
    title: 'You can substitute — check the caveats',
    subtitle: 'Some requirements have partial matches in your stash.',
  },
  red: {
    title: 'Missing materials',
    subtitle: 'One or more requirements need a trip to the yarn shop.',
  },
};

function StatusPill({ status, label }: { status: LightLevel; label?: string }) {
  const Icon = statusIcon[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusBg[status]} ${statusColor[status]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label ?? statusText[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function OverallBanner({ report }: { report: FeasibilityReport }) {
  const { title, subtitle } = overallHeadline[report.overallStatus];
  const Icon = statusIcon[report.overallStatus];

  return (
    <div className={`flex items-start gap-4 rounded-lg border p-4 md:p-6 ${statusBg[report.overallStatus]}`}>
      <Icon className={`h-10 w-10 flex-shrink-0 ${statusColor[report.overallStatus]}`} />
      <div>
        <h2 className={`text-xl font-semibold ${statusColor[report.overallStatus]}`}>{title}</h2>
        <p className="mt-1 text-sm text-gray-700">{subtitle}</p>
      </div>
    </div>
  );
}

function YarnSection({ yarn }: { yarn: YarnRequirementResult }) {
  const [showOthers, setShowOthers] = useState(false);
  const others = yarn.candidates.filter((c) => c.yarnId !== yarn.bestCandidate?.yarnId);

  return (
    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiPackage className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yarn</h3>
        </div>
        <StatusPill status={yarn.status} />
      </header>

      <p className="text-sm text-gray-700 dark:text-gray-300">{yarn.message}</p>

      <RequirementSummary requirement={yarn.requirement} />

      {yarn.bestCandidate ? (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
            Best match
          </h4>
          <CandidateCard candidate={yarn.bestCandidate} />
        </div>
      ) : null}

      {others.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            {showOthers ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
            {showOthers ? 'Hide' : 'Show'} {others.length} other candidate{others.length === 1 ? '' : 's'}
          </button>
          {showOthers ? (
            <div className="mt-3 space-y-3">
              {others.map((c) => (
                <CandidateCard key={c.yarnId} candidate={c} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RequirementSummary({ requirement }: { requirement: ParsedYarnRequirement }) {
  const parts: string[] = [];
  if (requirement.totalYardage) parts.push(`~${requirement.totalYardage} yds`);
  if (requirement.weightName) parts.push(`${requirement.weightName} weight`);
  if (requirement.fiberHints.length > 0) parts.push(requirement.fiberHints.join(' / '));
  if (requirement.skeinCount) parts.push(`${requirement.skeinCount} skeins`);

  if (parts.length === 0 && !requirement.rawText) {
    return (
      <p className="mt-2 text-sm italic text-gray-500">
        Pattern doesn&apos;t specify yarn requirements. Add them to get an accurate feasibility check.
      </p>
    );
  }

  return (
    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs uppercase tracking-wide text-gray-500">Pattern needs</dt>
        <dd className="text-gray-900 dark:text-gray-100">
          {parts.length > 0 ? parts.join(' · ') : 'Not parsed'}
        </dd>
      </div>
      {requirement.rawText && parts.length === 0 ? (
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-gray-500">Raw text</dt>
          <dd className="text-gray-700 dark:text-gray-300">{requirement.rawText}</dd>
        </div>
      ) : null}
    </dl>
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
          {candidate.brand ? (
            <p className="text-xs text-gray-500">{candidate.brand}</p>
          ) : null}
          {dims ? <p className="mt-1 text-sm text-gray-700">{dims}</p> : null}
          <p className="text-xs text-gray-500">{yardageLabel}</p>
        </div>
        <StatusPill status={candidate.level} />
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

function ToolsSection({ tools }: { tools: ToolRequirementResult }) {
  return (
    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiTool className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tools</h3>
        </div>
        <StatusPill status={tools.status} />
      </header>

      {tools.requirements.length === 0 ? (
        <p className="text-sm italic text-gray-500">
          {tools.rawText
            ? `Couldn't parse needle sizes from "${tools.rawText}". Add specific sizes to the pattern for a better check.`
            : "Pattern doesn't specify needle or hook sizes."}
        </p>
      ) : (
        <ul className="space-y-2">
          {tools.requirements.map((req) => (
            <li
              key={req.sizeMm}
              className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${statusBg[req.status]}`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{req.sizeMm} mm</p>
                <p className="text-sm text-gray-700">{req.message}</p>
                {req.matches.length > 0 ? (
                  <p className="mt-1 text-xs text-gray-600">
                    {req.matches
                      .slice(0, 3)
                      .map(
                        (m) =>
                          `${m.name}${m.sizeMm != null ? ` (${m.sizeMm}mm)` : ''}`,
                      )
                      .join(', ')}
                    {req.matches.length > 3 ? ` +${req.matches.length - 3} more` : null}
                  </p>
                ) : null}
              </div>
              <StatusPill status={req.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ShoppingListSection({ items }: { items: ShoppingListItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 p-4 md:p-6">
      <header className="mb-3 flex items-center gap-2">
        <FiShoppingCart className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-purple-900">
          Shopping List ({items.length})
        </h3>
      </header>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="rounded-lg bg-white p-3 shadow-sm">
            <p className="font-medium text-gray-900">{item.description}</p>
            <p className="mt-0.5 text-xs text-gray-500">{item.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function FeasibilityPanel({ patternId }: FeasibilityPanelProps) {
  const { data, isLoading, error } = useQuery<FeasibilityReport>({
    queryKey: ['pattern-feasibility', patternId],
    queryFn: async () => {
      const res = await axios.get(`/api/patterns/${patternId}/feasibility`);
      return res.data.data.feasibility as FeasibilityReport;
    },
    // Feasibility depends on pattern + entire stash + tools; refetch on tab
    // reopen after 30 s so stash edits propagate without manual reload.
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner text="AI is analyzing feasibility…" />
      </div>
    );
  }

  if (error) {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Could not load feasibility report.';
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 md:space-y-6">
      <OverallBanner report={data} />
      <YarnSection yarn={data.yarn} />
      <ToolsSection tools={data.tools} />
      <ShoppingListSection items={data.shoppingList} />
    </div>
  );
}
