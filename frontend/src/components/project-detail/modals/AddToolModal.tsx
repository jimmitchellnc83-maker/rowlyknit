import { useState } from 'react';
import { toast } from 'react-toastify';
import ModalShell from './ModalShell';

interface ToolOption {
  id: string;
  name: string;
  size?: string;
  type?: string;
}

interface AddToolModalProps {
  availableTools: ToolOption[];
  existingToolIds: string[];
  onClose: () => void;
  onSubmit: (toolId: string) => Promise<void>;
}

export default function AddToolModal({
  availableTools,
  existingToolIds,
  onClose,
  onSubmit,
}: AddToolModalProps) {
  const [selectedToolId, setSelectedToolId] = useState('');

  const handleAdd = async () => {
    if (!selectedToolId) {
      toast.error('Please select a tool');
      return;
    }
    try {
      await onSubmit(selectedToolId);
      onClose();
    } catch {
      // stay open on error
    }
  };

  return (
    <ModalShell titleId="add-tool-title" title="Add Tool to Project">
      <div className="p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Tool
        </label>
        <select
          value={selectedToolId}
          onChange={(e) => setSelectedToolId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
        >
          <option value="">Choose a tool...</option>
          {availableTools
            .filter((t) => !existingToolIds.includes(t.id))
            .map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.name}
                {tool.size && ` (${tool.size})`}
                {tool.type && ` - ${tool.type}`}
              </option>
            ))}
        </select>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Add Tool
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
