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
            className="text-purple-600 hover:text-purple-700 text-xs flex items-center gap-1"
            title="Select existing pattern"
          >
            <FiPlus className="h-4 w-4" />
            Select
          </button>
          <button
            onClick={onUploadClick}
            className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 flex items-center gap-1"
            title="Upload new pattern"
          >
            <FiPlus className="h-3 w-3" />
            Upload
          </button>
        </div>
      </div>

      {patterns.length > 0 ? (
        <ul className="space-y-2">
          {patterns.map((pattern: any) => (
            <li key={pattern.id} className="flex items-center justify-between text-sm">
              <Link
                to={`/patterns/${pattern.id}`}
                className="text-purple-600 hover:text-purple-700 flex-1"
              >
                {pattern.name}
              </Link>
              <button
                onClick={() => onRemove(pattern.id)}
                className="text-red-600 hover:text-red-700 ml-2"
                title="Remove pattern"
              >
                <FiX className="h-4 w-4" />
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
