import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { FiBell, FiX } from 'react-icons/fi';

interface ActiveMarker {
  id: string;
  name: string;
  alert_message: string;
  alert_type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  color: string | null;
}

interface Props {
  projectId: string;
  counterId: string;
  currentRow: number;
}

const PRIORITY_STYLES: Record<
  ActiveMarker['priority'],
  { bg: string; border: string; text: string }
> = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-300 dark:border-red-900',
    text: 'text-red-900 dark:text-red-200',
  },
  high: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-300 dark:border-amber-900',
    text: 'text-amber-900 dark:text-amber-200',
  },
  normal: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-300 dark:border-blue-900',
    text: 'text-blue-900 dark:text-blue-200',
  },
  low: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-800 dark:text-gray-200',
  },
};

/**
 * Shows any Magic Markers firing at the current master row. Uses the
 * existing `/api/projects/:id/magic-markers/active` endpoint scoped to
 * the panel group's master counter.
 */
export default function PanelMarkerBanner({
  projectId,
  counterId,
  currentRow,
}: Props) {
  const [markers, setMarkers] = useState<ActiveMarker[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchActive = useCallback(async () => {
    try {
      const res = await axios.get(
        `/api/projects/${projectId}/magic-markers/active`,
        { params: { row: currentRow, counterId } },
      );
      const list: ActiveMarker[] = res.data?.data?.markers || [];
      setMarkers(list);
      // Reset dismissals when the row changes so re-firing markers show up
      // again after the user advances past and back.
      setDismissed(new Set());
    } catch {
      // Non-critical — fail silent; markers are a convenience overlay.
      setMarkers([]);
    }
  }, [projectId, counterId, currentRow]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  const visible = markers.filter((m) => !dismissed.has(m.id));
  if (visible.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      {visible.map((marker) => {
        const styles = PRIORITY_STYLES[marker.priority] || PRIORITY_STYLES.normal;
        return (
          <div
            key={marker.id}
            className={`rounded-md border ${styles.bg} ${styles.border} ${styles.text} px-3 py-2 flex items-start gap-2`}
            style={
              marker.color
                ? { borderLeftWidth: 4, borderLeftColor: marker.color }
                : undefined
            }
            role="status"
          >
            <FiBell className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{marker.name}</p>
              {marker.alert_message && (
                <p className="text-xs mt-0.5 break-words">
                  {marker.alert_message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setDismissed((prev) => new Set(prev).add(marker.id))
              }
              aria-label="Dismiss marker"
              className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded flex-shrink-0"
            >
              <FiX className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
