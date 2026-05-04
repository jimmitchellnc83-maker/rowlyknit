import { Link } from 'react-router-dom';
import { FiPlus, FiX } from 'react-icons/fi';

interface Props {
  patterns: any[];
  onRemove: (patternId: string) => void;
  onSelectClick: () => void;
  onUploadClick: () => void;
}

export default function ProjectPatternsList({ patterns, onRemove, onSelectClick, onUploadClick }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Patterns</h2>
        <div className="flex gap-2">
          <button
            onClick={onSelectClick}
            className="inline-flex min-h-[44px] items-center gap-1 rounded px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 hover:text-purple-700"
            title="Select existing pattern"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" />
            Select
          </button>
          <button
            onClick={onUploadClick}
            className="inline-flex min-h-[44px] items-center gap-1 rounded bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
            title="Upload new pattern"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" />
            Upload
          </button>
        </div>
      </div>

      {patterns.length > 0 ? (
        <ul className="space-y-2">
          {patterns.map((pattern: any) => (
            <li key={pattern.id} className="flex items-center justify-between gap-2 text-sm">
              <Link
                to={`/patterns/${pattern.id}`}
                className="flex min-h-[44px] flex-1 items-center text-purple-600 hover:text-purple-700"
              >
                {pattern.name}
              </Link>
              <button
                onClick={() => onRemove(pattern.id)}
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-red-600 hover:bg-red-50 hover:text-red-700"
                title="Remove pattern"
                aria-label={`Remove ${pattern.name}`}
              >
                <FiX className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No patterns added</p>
      )}
    </div>
  );
}
