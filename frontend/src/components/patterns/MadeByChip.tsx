import { FiUsers } from 'react-icons/fi';

interface Props {
  count: number;
}

export default function MadeByChip({ count }: Props) {
  if (!count || count <= 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800"
      title={`${count} other knitter${count === 1 ? '' : 's'} publicly rated a project using this pattern.`}
      data-testid="made-by-chip"
    >
      <FiUsers className="h-3 w-3" aria-hidden="true" />
      Made by {count} other{count === 1 ? '' : 's'}
    </span>
  );
}
