import { Link } from 'react-router-dom';
import { FiHelpCircle } from 'react-icons/fi';

interface PageHelpButtonProps {
  /** Optional section anchor on the Help page (e.g. "#voice-commands"). */
  anchor?: string;
  /** Tooltip / aria-label text. Falls back to "Open help". */
  label?: string;
  className?: string;
}

/**
 * Small consistent Help link for page headers. Renders an icon-only circle
 * button with a tooltip, linking into the central `/help` page (optionally
 * deep-linked to a section). Designed to tuck into the top-right of any
 * page's header row next to primary actions like "New X".
 */
export default function PageHelpButton({
  anchor,
  label = 'Open help',
  className = '',
}: PageHelpButtonProps) {
  const href = anchor ? `/help${anchor.startsWith('#') ? anchor : `#${anchor}`}` : '/help';

  return (
    <Link
      to={href}
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-purple-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-purple-400 transition ${className}`}
    >
      <FiHelpCircle className="h-5 w-5" />
    </Link>
  );
}
