import { useMemo } from 'react';
import { computeDesign, normalizedGauge, type DesignerFormSnapshot } from '../../utils/designerSnapshot';
import { finishedAreaSqIn } from '../../utils/designerArea';
import { estimateYardageFromArea, formatYardage } from '../../utils/yardageEstimate';
import { estimatePerColorYardage } from '../../utils/yarnEstimatePerColor';

interface Props {
  form: DesignerFormSnapshot;
}

/**
 * Live yardage estimate inside the Designer editor. Shows the total range
 * (e.g. "1,200–1,500 yds") and, when the draft has both a chart and a
 * color palette, splits that total across the colors actually painted on
 * the chart so the user can see "MC 850–1,060 · CC 350–440" while still
 * editing.
 *
 * Math is shared with the saved-design card and the publishing-copy print
 * view (`finishedAreaSqIn` + `estimateYardageFromArea` +
 * `estimatePerColorYardage`), so all three surfaces agree.
 *
 * Renders nothing when the form isn't ready enough to compute an area —
 * keeps the sidebar quiet during the first few inputs of a new draft
 * rather than flashing "0 yds" placeholders.
 */
export default function YardageEstimateWidget({ form }: Props) {
  const { area, total, breakdown } = useMemo(() => {
    const compute = computeDesign(form);
    const a = finishedAreaSqIn(compute);
    if (a == null || a <= 0) return { area: null, total: null, breakdown: null };
    const gauge = normalizedGauge(form);
    const tot = estimateYardageFromArea(a, gauge);
    const b =
      form.chart && form.colors.length > 0
        ? estimatePerColorYardage(a, gauge, form.chart, form.colors)
        : null;
    return { area: a, total: tot, breakdown: b };
  }, [form]);

  if (area == null || total == null) return null;

  return (
    <section
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10"
      aria-label="Estimated yarn"
    >
      <h3 className="mb-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
        Estimated yarn
      </h3>
      <p className="text-base font-bold text-amber-900 dark:text-amber-100">
        {formatYardage(total)}
      </p>
      {breakdown && breakdown.rows.length > 1 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-200">
          {breakdown.rows.map((row) => (
            <li key={row.hex} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 flex-shrink-0 rounded border border-amber-300"
                style={{ backgroundColor: row.hex }}
                aria-hidden="true"
              />
              <span className="font-medium">
                {row.isMain ? 'MC · ' : ''}
                {row.label}
              </span>
              <span className="text-amber-700 dark:text-amber-400">·</span>
              <span>{formatYardage(row.yardage)}</span>
              <span className="text-amber-700 dark:text-amber-400">·</span>
              <span className="text-amber-700 dark:text-amber-400">
                {Math.round(row.fraction * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
        Rough range from finished area × gauge. Cables use more, lace uses less. Add 10–15% for
        stranded colorwork. Buy extra for swatching and weaving in.
      </p>
    </section>
  );
}
