import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2, FiUser, FiEye, FiEyeOff, FiShare2, FiCopy, FiPlay } from 'react-icons/fi';
import { toast } from 'react-toastify';
import HelpTooltip from '../HelpTooltip';
import { useKnittingMode } from '../../contexts/KnittingModeContext';
import { writeKnittingMode } from '../../utils/knittingModeStorage';
import { isDesignerMakeModeEnabled } from '../../lib/featureFlags';
import MakeModePicker, { type MakeModePickerPattern } from './MakeModePicker';

interface ProjectSummary {
  name: string;
  status: string;
  project_type?: string;
}

interface RecipientSummary {
  first_name: string;
  last_name: string;
}

export interface ProjectPatternSummary {
  id: string;
  name?: string | null;
  designer?: string | null;
  canonicalPatternModelId?: string | null;
}

interface ProjectHeaderProps {
  projectId: string;
  project: ProjectSummary;
  patterns: ProjectPatternSummary[];
  selectedRecipient: RecipientSummary | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onDuplicate: () => void;
  duplicating?: boolean;
  isPublic: boolean;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'planned':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function ProjectHeader({
  projectId,
  project,
  patterns,
  selectedRecipient,
  onEdit,
  onDelete,
  onShare,
  onDuplicate,
  duplicating = false,
  isPublic,
}: ProjectHeaderProps) {
  const { knittingMode, setKnittingMode } = useKnittingMode();
  const navigate = useNavigate();
  const [showPicker, setShowPicker] = useState(false);

  // Canonical Make Mode entry decision: when at least one attached pattern
  // has a canonical pattern_models twin AND the flag is on, the primary
  // CTA routes into row-by-row canonical Make Mode (persists progress to
  // pattern_models.progress_state). N=1 → direct link; N≥2 → picker.
  // Patterns without a twin fall through to the legacy "Resume Knitting"
  // project workspace, which stays available as a secondary action so
  // project-scoped counters / sessions / QuickKeys aren't orphaned.
  const makeModeEnabled = isDesignerMakeModeEnabled();
  const canonicalCandidates = useMemo<MakeModePickerPattern[]>(
    () =>
      (patterns ?? [])
        .filter((p): p is ProjectPatternSummary & { id: string } => Boolean(p?.id))
        .map((p) => ({
          id: p.id,
          name: p.name ?? null,
          designer: p.designer ?? null,
          canonicalPatternModelId: p.canonicalPatternModelId ?? null,
        })),
    [patterns],
  );
  const canonicalCount = useMemo(
    () =>
      canonicalCandidates.filter((p) => p.canonicalPatternModelId).length,
    [canonicalCandidates],
  );
  const showCanonicalEntry = makeModeEnabled && canonicalCount > 0;
  // Direct-navigate ONLY when the project has exactly one attached
  // pattern AND that pattern has a canonical twin. Multi-pattern projects
  // always go through the picker — even when only one pattern has a
  // twin — so the user can see the legacy-only siblings (rendered as
  // disabled rows in MakeModePicker) and isn't routed past them.
  const directNavigateTarget =
    canonicalCandidates.length === 1 && canonicalCount === 1
      ? canonicalCandidates[0].canonicalPatternModelId
      : null;

  const handleOpenMakeMode = () => {
    if (!showCanonicalEntry) return;
    if (directNavigateTarget) {
      navigate(`/patterns/${directNavigateTarget}/make`);
      return;
    }
    setShowPicker(true);
  };

  const handleToggleKnittingMode = () => {
    const next = !knittingMode;
    setKnittingMode(next);
    writeKnittingMode(projectId, next);
    if (next) {
      toast.success('Project workspace activated! 🧶');
    } else {
      toast.info('Project workspace deactivated');
    }
  };

  return (
    <div className="mb-6">
      <Link
        to="/projects"
        className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
      >
        <FiArrowLeft className="mr-2" />
        Back to Projects
      </Link>

      {/* Stacked responsive header — mirrors the Designer header pattern.
            Row 1 — title + status pill (never clipped, never sharing space
                    with action buttons on small screens).
            Row 2 — project type + recipient subtext (only when present).
            Row 3 — action toolbar; wraps freely, every button gets a
                    44px+ touch target.
         The old single-row `flex justify-between` collided around
         ~900px because the actions row had grown to 7 buttons; the
         flex-shrink rules then gnawed the title text instead of
         wrapping the buttons. This layout never fights for space. */}
      <header
        data-testid="project-header"
        className="flex flex-col gap-3"
      >
        <div
          data-testid="project-header-title"
          className="flex flex-wrap items-center gap-2"
        >
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{project.name}</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(project.status)}`}
          >
            {project.status}
          </span>
        </div>

        {(project.project_type || selectedRecipient) && (
          <div className="flex flex-col gap-1 text-sm text-gray-600">
            {project.project_type && <p>Type: {project.project_type}</p>}
            {selectedRecipient && (
              <p className="flex items-center">
                <FiUser className="mr-2 h-4 w-4" />
                Gift for: {selectedRecipient.first_name} {selectedRecipient.last_name}
              </p>
            )}
          </div>
        )}

        <div
          data-testid="project-header-actions"
          className="flex flex-wrap items-center gap-2"
        >
          {showCanonicalEntry && (
            <button
              type="button"
              onClick={handleOpenMakeMode}
              data-testid="project-open-make-mode"
              title="Open in Make Mode — row-by-row tracker, persists per pattern"
              className="inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <FiPlay className="mr-2 h-5 w-5 md:h-4 md:w-4" />
              <span className="text-base md:text-sm">Open in Make Mode</span>
            </button>
          )}
          <button
            onClick={handleToggleKnittingMode}
            data-testid="project-toggle-workspace"
            className={`inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 font-medium transition ${
              knittingMode
                ? 'bg-green-600 text-white hover:bg-green-700'
                : showCanonicalEntry
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-purple-600 text-white shadow-sm hover:bg-purple-700'
            }`}
          >
            {knittingMode ? (
              <FiEyeOff className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            ) : (
              <FiEye className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            )}
            <span className="text-base md:text-sm">
              {knittingMode
                ? 'Exit project workspace'
                : showCanonicalEntry
                  ? 'Project workspace'
                  : 'Resume Knitting'}
            </span>
          </button>
          <HelpTooltip
            text={
              showCanonicalEntry
                ? 'Open in Make Mode — row-by-row tracker for the canonical pattern (persists row counters per pattern). Project workspace — focused project-scoped layout with counters, markers, timer, and references.'
                : 'Resume Knitting — focused active-knitting workspace with your pattern, counters, markers, timer, and references.'
            }
          />
          <button
            onClick={onShare}
            aria-label={isPublic ? 'Share — currently public' : 'Share — currently private'}
            className={`inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 transition ${
              isPublic
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <FiShare2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            <span className="text-base md:text-sm">{isPublic ? 'Public' : 'Share'}</span>
          </button>
          <button
            onClick={onDuplicate}
            disabled={duplicating}
            title="Make a fresh copy with the same pattern, tools, counters, and pieces — but no yarn, photos, or row history."
            className="inline-flex min-h-[44px] items-center rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition hover:bg-gray-300 disabled:opacity-60"
          >
            <FiCopy className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            <span className="text-base md:text-sm">{duplicating ? 'Copying…' : 'Make this again'}</span>
          </button>
          <button
            onClick={onEdit}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
          >
            <FiEdit2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            <span className="text-base md:text-sm">Edit</span>
          </button>
          <button
            onClick={onDelete}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
          >
            <FiTrash2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            <span className="text-base md:text-sm">Delete</span>
          </button>
        </div>
      </header>

      {showPicker && (
        <MakeModePicker
          patterns={canonicalCandidates}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
