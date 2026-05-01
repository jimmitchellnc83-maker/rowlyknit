import { useState } from 'react';
import { FiCopy, FiCheck, FiHeart, FiInfo } from 'react-icons/fi';
import { getActiveCycEvents, type CycEvent } from '../../utils/cycCalendar';

interface CycEventBannerProps {
  /** Override the date used to look up active events. Tests pass a
   *  fixed instance; production omits this so it picks up "now". */
  now?: Date;
  /** Caller can choose to render only one event id (when multiple are
   *  active simultaneously, which doesn't happen with current rules
   *  but the API stays open). */
  filter?: (event: CycEvent) => boolean;
}

const EVENT_ICONS: Record<string, JSX.Element> = {
  'stitch-away-stress': <FiHeart className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
  'i-love-yarn-day': <FiHeart className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
};

/**
 * Surfaces an active CYC marketing event (Stitch Away Stress in April,
 * I Love Yarn Day on the 2nd Saturday of October). Renders NULL when
 * no event is currently active. The hashtag has a one-click copy
 * button so users can drop it into their socials.
 *
 * Drop-in for the dashboard, the project list page, or anywhere a
 * passive seasonal nudge is appropriate. Keep it small — knitters
 * shouldn't have to dismiss it.
 */
export default function CycEventBanner({ now, filter }: CycEventBannerProps) {
  const events = getActiveCycEvents(now ?? new Date()).filter(
    filter ?? (() => true),
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (events.length === 0) return null;

  const handleCopy = (event: CycEvent) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(event.hashtag);
      setCopiedId(event.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          role="status"
          className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20"
        >
          <div className="flex-shrink-0 mt-0.5">
            {EVENT_ICONS[event.id] ?? <FiInfo className="h-5 w-5 text-purple-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {event.title}
              </h3>
              <button
                type="button"
                onClick={() => handleCopy(event)}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-mono text-purple-700 hover:bg-purple-100 dark:bg-gray-800 dark:text-purple-300 dark:hover:bg-purple-900/40 transition"
                aria-label={`Copy ${event.hashtag}`}
              >
                {copiedId === event.id ? (
                  <>
                    <FiCheck className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <FiCopy className="h-3 w-3" />
                    {event.hashtag}
                  </>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              {event.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
