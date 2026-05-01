import { useMemo, useState } from 'react';
import { FiUsers, FiCheck } from 'react-icons/fi';
import { useRecipients } from '../../hooks/useApi';
import {
  recipientToBodyBlock,
  recipientToSock,
  recipientToMitten,
} from '../../utils/recipientToDesigner';
import { sanitizeMeasurements, type RecipientMeasurements } from '../../types/measurements';

interface PrefillTarget {
  itemType: 'sweater' | 'socks' | 'mittens';
  /** Total length already entered on the form, used by the body-block
   *  mapper to derive `waistHeightFromHem` from `backWaistLength`. */
  totalLengthIn?: number;
}

interface PrefillSeed {
  /** Form fields to merge in. Already converted to the form's display
   *  unit (cm / in). The caller spreads this into setForm. */
  fields: Record<string, number>;
  /** Recipient name for the toast / banner. */
  recipientName: string;
}

interface Props {
  target: PrefillTarget;
  /** The form's active display unit ('in' or 'cm'). The mapper outputs
   *  inches; we convert here so callers can spread blindly. */
  unit: 'in' | 'cm';
  onApply: (seed: PrefillSeed) => void;
}

interface RecipientApi {
  id: string;
  first_name: string;
  last_name: string;
  measurements: unknown;
}

const CM_PER_IN = 2.54;

const toUnit = (inches: number, unit: 'in' | 'cm'): number =>
  Math.round((unit === 'cm' ? inches * CM_PER_IN : inches) * 100) / 100;

/**
 * "Pre-fill from a recipient" picker. Lists recipients with at least
 * one usable measurement, runs the appropriate `recipientTo*` mapper
 * for the active item type, and bubbles a {fields, recipientName}
 * seed up so the parent can `setForm({ ...form, ...seed.fields })`.
 *
 * Hides itself when the user has no recipients with measurements
 * recorded — most knitters won't have many of these saved up front.
 */
export default function RecipientPrefillPicker({ target, unit, onApply }: Props) {
  const { data, isLoading } = useRecipients() as {
    data: RecipientApi[] | undefined;
    isLoading: boolean;
  };
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const recipientsWithData = useMemo(() => {
    if (!data) return [];
    return data
      .map((r) => ({
        id: r.id,
        name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'Unnamed recipient',
        measurements: sanitizeMeasurements(r.measurements as Partial<RecipientMeasurements> | null),
      }))
      .filter((r) => Object.keys(r.measurements).length > 0);
  }, [data]);

  if (isLoading) return null;
  if (recipientsWithData.length === 0) return null;

  const handleApply = (recipient: typeof recipientsWithData[number]) => {
    const m = recipient.measurements;
    let inches: Record<string, number> = {};

    if (target.itemType === 'sweater') {
      const seed = recipientToBodyBlock(m, { totalLength: target.totalLengthIn });
      if (seed.chestCircumference !== undefined) {
        inches.chestCircumference = seed.chestCircumference;
      }
      if (seed.waist) {
        inches.waistCircumference = seed.waist.waistCircumference;
        inches.waistHeightFromHem = seed.waist.waistHeightFromHem;
      }
      if (seed.hip) {
        inches.hipCircumference = seed.hip.hipCircumference;
      }
      // Sleeve fields if recorded.
      if (typeof m.upperArm === 'number') inches.bicepCircumference = m.upperArm;
      if (typeof m.armLength === 'number') inches.cuffToUnderarmLength = m.armLength;
    } else if (target.itemType === 'socks') {
      const seed = recipientToSock(m);
      if (seed.footLength !== undefined) inches.footLength = seed.footLength;
      if (seed.footCircumference !== undefined) inches.footCircumference = seed.footCircumference;
      if (seed.ankleCircumference !== undefined) inches.ankleCircumference = seed.ankleCircumference;
      if (seed.legLength !== undefined) inches.legLength = seed.legLength;
    } else if (target.itemType === 'mittens') {
      const seed = recipientToMitten(m);
      if (seed.handCircumference !== undefined) inches.handCircumference = seed.handCircumference;
      if (seed.cuffToThumbLength !== undefined) inches.cuffToThumbLength = seed.cuffToThumbLength;
      if (seed.thumbToTipLength !== undefined) inches.thumbToTipLength = seed.thumbToTipLength;
    }

    const fields: Record<string, number> = {};
    for (const [k, v] of Object.entries(inches)) {
      fields[k] = toUnit(v, unit);
    }
    onApply({ fields, recipientName: recipient.name });
    setAppliedId(recipient.id);
    window.setTimeout(() => setAppliedId((curr) => (curr === recipient.id ? null : curr)), 2000);
  };

  return (
    <div className="mb-3 rounded-md border border-purple-200 bg-purple-50 p-2.5 dark:border-purple-800 dark:bg-purple-900/20">
      <div className="flex items-center gap-1.5 mb-1.5">
        <FiUsers className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300" />
        <span className="text-xs font-semibold uppercase tracking-wide text-purple-800 dark:text-purple-200">
          Pre-fill from recipient
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {recipientsWithData.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => handleApply(r)}
            className={
              appliedId === r.id
                ? 'inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white'
                : 'inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-gray-800 dark:text-purple-300 dark:hover:bg-purple-900/40'
            }
            title={`Apply ${r.name}'s saved measurements`}
          >
            {appliedId === r.id ? <FiCheck className="h-3 w-3" /> : null}
            {r.name}
          </button>
        ))}
      </div>
    </div>
  );
}
