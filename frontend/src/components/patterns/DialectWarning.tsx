import { FiAlertTriangle, FiArrowRight, FiCheck } from 'react-icons/fi';
import type {
  CrochetDialect,
  DialectDetectionResult,
} from '../../utils/crochetDialect';

interface DialectWarningProps {
  /** Result of `detectCrochetDialect(text)`. */
  detection: DialectDetectionResult;
  /** What dialect the user wants the imported text to land in. */
  targetDialect: CrochetDialect;
  /** Called when the user confirms the auto-conversion. The caller
   *  runs `convertCrochetDialect(text, detection.dialect, target)`
   *  and updates the working text. */
  onConvert: () => void;
  /** Whether the conversion has already been applied — flips the
   *  banner from "convert?" to "converted ✓". */
  converted?: boolean;
}

const DIALECT_LABEL: Record<CrochetDialect, string> = {
  us: 'US',
  uk: 'UK',
};

/**
 * Surfaces a US/UK crochet dialect mismatch on pattern import. Renders
 * NULL (no banner) when:
 *   - detection is `unknown`,
 *   - detected dialect already matches the target,
 *   - no signals were found at all.
 *
 * Drop into any pattern-import surface (BlogImportModal,
 * PatternFileUpload, the future "paste raw text" flow) so the warning
 * + convert offer stays consistent across surfaces.
 */
export default function DialectWarning({
  detection,
  targetDialect,
  onConvert,
  converted,
}: DialectWarningProps) {
  if (
    detection.dialect === 'unknown' ||
    detection.dialect === targetDialect ||
    detection.signals.length === 0
  ) {
    return null;
  }

  const detectedLabel = DIALECT_LABEL[detection.dialect];
  const targetLabel = DIALECT_LABEL[targetDialect];
  const isLowConfidence = detection.confidence < 0.7;
  const signalSummary = detection.signals
    .slice(0, 3)
    .map((s) => `${s.token} × ${s.count}`)
    .join(', ');

  if (converted) {
    return (
      <div
        role="status"
        className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-100"
      >
        <div className="flex items-start gap-2">
          <FiCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            Converted from {detectedLabel} to {targetLabel} crochet abbreviations.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100"
    >
      <div className="flex items-start gap-2">
        <FiAlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div>
            This pattern looks like <strong>{detectedLabel}</strong> crochet
            terminology, but your preference is <strong>{targetLabel}</strong>.
            {isLowConfidence ? (
              <span className="ml-1 italic opacity-80">(low confidence — verify before converting)</span>
            ) : null}
          </div>
          {signalSummary ? (
            <div className="mt-1 text-xs opacity-80">
              Signals: {signalSummary}
            </div>
          ) : null}
          {detection.ambiguous.length > 0 ? (
            <div className="mt-1 text-xs opacity-80">
              Ambiguous tokens (different stitch in each tradition):{' '}
              {detection.ambiguous.join(', ')}
            </div>
          ) : null}
          <div className="mt-2">
            <button
              type="button"
              onClick={onConvert}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              Convert to {targetLabel}
              <FiArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
