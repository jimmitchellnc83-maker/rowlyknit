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
          className="text-purple-600 hover:text-purple-700"
          title="Add tool"
        >
          <FiPlus className="h-5 w-5" />
        </button>
      </div>

      {tools.length > 0 ? (
        <ul className="space-y-2">
          {tools.map((tool: any) => (
            <li key={tool.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 flex-1">
                {tool.name}
                {tool.size && <span className="text-gray-500"> ({tool.size})</span>}
              </span>
              <button
                onClick={() => onRemove(tool.id)}
                className="text-red-600 hover:text-red-700 ml-2"
                title="Remove tool"
              >
                <FiX className="h-4 w-4" />
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
