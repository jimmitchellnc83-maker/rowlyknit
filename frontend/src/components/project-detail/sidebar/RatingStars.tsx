import { FiStar } from 'react-icons/fi';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export default function RatingStars({
  value,
  onChange,
  readOnly = false,
  size = 'md',
  ariaLabel = 'Rating',
}: Props) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const interactive = !readOnly && !!onChange;

  return (
    <div
      className="inline-flex items-center gap-1"
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`${ariaLabel}: ${value} of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const className = `${iconSize} ${filled ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'}`;
        if (interactive) {
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="transition-transform hover:scale-110"
              role="radio"
              aria-checked={n === value}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
            >
              <FiStar className={className} />
            </button>
          );
        }
        return <FiStar key={n} className={className} aria-hidden="true" />;
      })}
    </div>
  );
}
