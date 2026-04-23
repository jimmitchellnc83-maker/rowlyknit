import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiHelpCircle, FiX } from 'react-icons/fi';
import { getHelpForRoute } from '../../help/pageHelpContent';
import { useKnittingMode } from '../../contexts/KnittingModeContext';

/**
 * Floating contextual help. Auto-detects the current route and shows
 * content keyed in pageHelpContent.ts. If no route matches, the button
 * doesn't render at all — no noisy "no help here" state.
 *
 * Hidden while Knitting Mode is active (the user is mid-row, a drawer
 * would cover their instructions).
 */
export default function PageHelp() {
  const location = useLocation();
  const { knittingMode } = useKnittingMode();
  const [open, setOpen] = useState(false);

  const help = useMemo(
    () => getHelpForRoute(location.pathname),
    [location.pathname],
  );

  // Auto-close when the route changes so old content doesn't linger.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!help || knittingMode) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Help for ${help.title}`}
        className="fixed bottom-24 right-4 md:bottom-4 md:right-4 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
      >
        <FiHelpCircle className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/50"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="page-help-title"
        >
          <div
            className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:h-full shadow-xl overflow-hidden flex flex-col rounded-t-xl sm:rounded-none"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <div className="min-w-0 flex-1">
                <h2
                  id="page-help-title"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {help.title}
                </h2>
                {help.tagline && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {help.tagline}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="ml-3 p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              <div className="space-y-5">
                {help.sections.map((section, i) => (
                  <section key={i}>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
                      {section.heading}
                    </h3>
                    <BodyText text={section.body} />
                    {section.tip && (
                      <div className="mt-2 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 px-3 py-2 text-xs text-purple-800 dark:text-purple-200">
                        <span className="font-semibold">Tip:</span>{' '}
                        <span>{section.tip}</span>
                      </div>
                    )}
                  </section>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Need more? The full{' '}
                  <a
                    href="/help"
                    className="text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Help page
                  </a>{' '}
                  covers everything across Rowly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Render body text with simple paragraph breaks on \n\n and bold on **text**.
 * Good enough for our help content; avoids pulling in a markdown dep.
 */
function BodyText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2 leading-relaxed">
      {paragraphs.map((para, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {renderInline(para)}
        </p>
      ))}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** markers, preserving the delimiter context.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-gray-900 dark:text-gray-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
