import { FiPlus, FiX } from 'react-icons/fi';

interface Props {
  tools: any[];
  onRemove: (toolId: string) => void;
  onAddClick: () => void;
}

export default function ProjectToolsList({ tools, onRemove, onAddClick }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Tools</h2>
        <button
          onClick={onAddClick}
          className="inline-flex h-11 w-11 items-center justify-center rounded text-purple-600 hover:bg-purple-50 hover:text-purple-700"
          title="Add tool"
          aria-label="Add tool"
        >
          <FiPlus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {tools.length > 0 ? (
        <ul className="space-y-2">
          {tools.map((tool: any) => (
            <li key={tool.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-h-[44px] flex-1 items-center text-gray-700">
                {tool.name}
                {tool.size && <span className="text-gray-500">&nbsp;({tool.size})</span>}
              </span>
              <button
                onClick={() => onRemove(tool.id)}
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-red-600 hover:bg-red-50 hover:text-red-700"
                title="Remove tool"
                aria-label={`Remove ${tool.name}`}
              >
                <FiX className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No tools added</p>
      )}
    </div>
  );
}
