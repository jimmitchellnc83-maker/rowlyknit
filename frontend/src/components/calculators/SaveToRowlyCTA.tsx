/**
 * SaveToRowlyCTA — orchestrator for the public-tool save flow.
 *
 * One drop-in CTA that every public calculator imports. Branches on
 * auth + entitlement state:
 *
 *   logged out               → store result, redirect to /login?next=…&pendingSave=1
 *   logged in, not entitled  → open UpgradePromptModal
 *   logged in, entitled      → open SaveDestinationPicker
 *
 * Auto-resume: if the page lands with `?pendingSave=1` AND the user is
 * now authenticated AND the pendingSave envelope's returnPath matches
 * this calculator's route, the CTA opens its picker automatically with
 * the stored result. The page-level prop `autoResume` lets the calc
 * page wire this without duplicating the storage logic.
 *
 * The CTA never blocks the public tool. The button is always visible;
 * the side-effects of the click branch on user state.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { trackEvent } from '../../lib/analytics';
import {
  setPendingSave,
  consumePendingSave,
} from '../../lib/pendingSave';
import { canUsePaidWorkspace } from '../../lib/entitlement';
import type { ToolResult } from '../../lib/toolResult';
import { getPublicTool } from '../../lib/publicTools';
import SaveDestinationPicker from './SaveDestinationPicker';
import UpgradePromptModal from './UpgradePromptModal';

interface Props {
  /** Set null while no result has been generated; the button stays disabled. */
  result: ToolResult | null;
  /** Called once after a successful save. */
  onSaved?: (projectId: string) => void;
  /**
   * Override the button label. Default is the tool's recommended copy
   * from the registry; pass per-tool when a specific verb reads
   * better ("Save this gauge to a project").
   */
  label?: string;
  /**
   * If true, the CTA reads the `?pendingSave=1` URL param + localStorage
   * envelope on mount and re-opens the save flow with the stored result.
   * Set true on the public tool page itself; false anywhere else.
   */
  autoResume?: boolean;
}

const DEFAULT_LABEL: Record<string, string> = {
  gauge: 'Save this gauge to a project',
  size: 'Create a project from this size',
  yardage: 'Save this yarn estimate',
  'row-repeat': 'Send this repeat to Make Mode',
  shaping: 'Send this shaping plan to Make Mode',
};

export default function SaveToRowlyCTA({
  result,
  onSaved,
  label,
  autoResume = false,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [resumedResult, setResumedResult] = useState<ToolResult | null>(null);

  // Auto-resume: when the page lands with ?pendingSave=1 and the user
  // is now authenticated, replay the stored save flow with the
  // previously-calculated result. We do this once, on mount.
  useEffect(() => {
    if (!autoResume) return;
    const params = new URLSearchParams(location.search);
    if (params.get('pendingSave') !== '1') return;
    if (!isAuthenticated) return;

    const env = consumePendingSave();
    if (!env) {
      // Stored envelope expired or was cleared. Just strip the query
      // param and move on; the user won't see a phantom modal.
      params.delete('pendingSave');
      const cleaned = `${location.pathname}${
        params.toString() ? `?${params.toString()}` : ''
      }${location.hash}`;
      navigate(cleaned, { replace: true });
      return;
    }

    // Re-open the flow with the stored result, gated on entitlement.
    setResumedResult(env.result);
    const ent = canUsePaidWorkspace(user);
    if (ent.allowed) setPickerOpen(true);
    else setUpgradeOpen(true);

    params.delete('pendingSave');
    const cleaned = `${location.pathname}${
      params.toString() ? `?${params.toString()}` : ''
    }${location.hash}`;
    navigate(cleaned, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const activeResult = resumedResult ?? result;

  const buttonLabel = label ?? (activeResult ? DEFAULT_LABEL[activeResult.toolId] ?? 'Save to Rowly' : 'Save to Rowly');

  const handleClick = () => {
    if (!activeResult) return;

    trackEvent('save_to_rowly_clicked', {
      toolId: activeResult.toolId,
      auth: isAuthenticated ? 'in' : 'out',
    });

    if (!isAuthenticated) {
      // Persist the result, then bounce through login. The
      // returnPath is the current public-tool route — the auth flow
      // already honors a `next=` query param.
      const returnPath = `${location.pathname}?pendingSave=1`;
      setPendingSave(activeResult, returnPath);
      trackEvent('signup_started_from_public_tool', {
        toolId: activeResult.toolId,
      });
      const next = encodeURIComponent(returnPath);
      navigate(`/login?next=${next}&pendingSave=1`);
      return;
    }

    const ent = canUsePaidWorkspace(user);
    if (!ent.allowed) {
      setUpgradeOpen(true);
      return;
    }
    setPickerOpen(true);
  };

  const tool = activeResult ? getPublicTool(activeResult.toolId) : null;
  const titleForModal = tool?.title ?? 'Save to Rowly';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!activeResult}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {buttonLabel}
      </button>

      {activeResult && (
        <SaveDestinationPicker
          open={pickerOpen}
          result={activeResult}
          title={titleForModal}
          onClose={() => {
            setPickerOpen(false);
            setResumedResult(null);
          }}
          onSaved={(projectId) => {
            onSaved?.(projectId);
            setResumedResult(null);
          }}
        />
      )}

      {activeResult && (
        <UpgradePromptModal
          open={upgradeOpen}
          result={activeResult}
          toolTitle={titleForModal}
          onClose={() => {
            setUpgradeOpen(false);
            setResumedResult(null);
          }}
        />
      )}
    </>
  );
}
