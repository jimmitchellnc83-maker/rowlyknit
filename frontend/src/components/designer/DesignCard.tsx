import { Link } from 'react-router-dom';
import { FiEdit3, FiPrinter, FiTool } from 'react-icons/fi';
import { resolveStitchKey } from '../../data/stitchSvgLibrary';
import { computeDesign, type DesignerFormSnapshot } from '../../utils/designerSnapshot';
import { estimateYardageFromArea, formatYardage } from '../../utils/yardageEstimate';
import { finishedAreaSqIn } from '../../utils/designerArea';
import { normalizedGauge } from '../../utils/designerSnapshot';
import BodySchematic from './BodySchematic';
import HatSchematic from './HatSchematic';
import MittenSchematic from './MittenSchematic';
import RectSchematic from './RectSchematic';
import ShawlSchematic from './ShawlSchematic';
import SockSchematic from './SockSchematic';
import CustomDraftSchematic from './CustomDraftSchematic';
import { buildBodyInput } from '../../utils/designerSnapshot';

interface DesignCardProps {
  form: DesignerFormSnapshot;
  /** Pass projectId when embedded in a project context; the "View / Print"
   *  button deep-links to `/designer/print?projectId=...`. */
  projectId?: string;
  /** Pass patternId when embedded in a pattern-library context; the "View /
   *  Print" button deep-links to `/designer/print?patternId=...`. */
  patternId?: string;
}

/**
 * Compact summary of a saved design — shows the item type, finished
 * dimensions, cast-on, yardage estimate, a small schematic, and links to
 * open or print the full pattern. Designed to sit inside Project Detail or
 * Pattern Detail pages without dominating the layout.
 */
export default function DesignCard({ form, projectId, patternId }: DesignCardProps) {
  const printHref = projectId
    ? `/designer/print?projectId=${projectId}`
    : patternId
      ? `/designer/print?patternId=${patternId}`
      : '/designer/print';
  const showActions = !!(projectId || patternId);
  const compute = computeDesign(form);
  const gauge = normalizedGauge(form);

  const area = finishedAreaSqIn(compute);
  const yardageLabel = area !== null ? formatYardage(estimateYardageFromArea(area, gauge)) : null;

  // Pick a schematic to thumbnail in the card.
  const schematic = renderThumbnailSchematic(form, compute);

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4 dark:border-purple-900/40 dark:bg-purple-900/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FiTool className="h-4 w-4 text-purple-600" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Design: {compute.summary.itemLabel}
            </h3>
          </div>
          <ul className="mt-2 space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
            {compute.summary.dimensions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
            {compute.summary.castOnStitches !== null && (
              <li>Cast on {compute.summary.castOnStitches} sts</li>
            )}
            {yardageLabel && <li>Estimated yarn: {yardageLabel}</li>}
            {form.colors.length > 0 && (
              <li className="flex items-center gap-1">
                Colors:
                {form.colors.map((c) => (
                  <span
                    key={c.id}
                    className="ml-0.5 inline-block h-3 w-3 rounded border border-gray-300"
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </li>
            )}
            {form.chart && (() => {
              const filled = form.chart.cells.filter((c) => {
                if (c.colorHex) return true;
                if (!c.symbolId) return false;
                return (resolveStitchKey(c.symbolId) ?? c.symbolId) !== 'no-stitch';
              }).length;
              return (
                <li className="text-xs text-gray-500 dark:text-gray-400">
                  Chart: {form.chart!.width}×{form.chart!.height}{' '}
                  {filled > 0 ? `(${filled} cells filled)` : '(blank)'}
                </li>
              );
            })()}
          </ul>

          {showActions && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={patternId ? `/designer?patternId=${patternId}` : '/designer'}
                className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50"
              >
                <FiEdit3 className="h-3 w-3" />
                {patternId ? 'Edit in Designer' : 'Open Designer'}
              </Link>
              <Link
                to={printHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50"
              >
                <FiPrinter className="h-3 w-3" />
                View / Print
              </Link>
            </div>
          )}
        </div>

        {schematic && (
          <div className="w-40 shrink-0 md:w-56">
            <div className="scale-[0.8] origin-top-right">{schematic}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderThumbnailSchematic(
  form: DesignerFormSnapshot,
  compute: ReturnType<typeof computeDesign>,
): React.ReactNode {
  const gauge = normalizedGauge(form);

  if (compute.body) {
    return <BodySchematic input={buildBodyInput(form, gauge)} output={compute.body} unit={form.unit} chart={form.chart} />;
  }
  if (compute.hat) return <HatSchematic output={compute.hat} unit={form.unit} chart={form.chart} />;
  if (compute.scarf)
    return (
      <RectSchematic
        label="Scarf"
        accent="purple"
        widthInches={compute.scarf.finishedWidth}
        lengthInches={compute.scarf.finishedLength}
        castOnStitches={compute.scarf.castOnStitches}
        fringeInches={compute.scarf.fringeLength}
        unit={form.unit}
        chart={form.chart}
      />
    );
  if (compute.blanket)
    return (
      <RectSchematic
        label="Blanket"
        accent="green"
        widthInches={compute.blanket.finishedWidth}
        lengthInches={compute.blanket.finishedLength}
        castOnStitches={compute.blanket.castOnStitches}
        borderInches={typeof form.blanketBorderDepth === 'number' ? form.blanketBorderDepth : 0}
        unit={form.unit}
        chart={form.chart}
      />
    );
  if (compute.shawl) return <ShawlSchematic output={compute.shawl} unit={form.unit} chart={form.chart} />;
  if (compute.mittens) return <MittenSchematic output={compute.mittens} unit={form.unit} chart={form.chart} />;
  if (compute.socks) return <SockSchematic output={compute.socks} unit={form.unit} chart={form.chart} />;
  if (compute.customDraft) {
    return (
      <CustomDraftSchematic
        output={compute.customDraft}
        unit={form.unit}
        chart={form.chart}
      />
    );
  }
  return null;
}
