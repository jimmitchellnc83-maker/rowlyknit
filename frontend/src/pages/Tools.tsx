import { useState, useCallback } from 'react';
import { FiPlus, FiTrash2, FiTool, FiEdit2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useEscapeKey } from '../hooks/useEscapeKey';
import ConfirmModal from '../components/ConfirmModal';
import { useTools as useToolsQuery, useCreateTool, useUpdateTool, useDeleteTool } from '../hooks/useApi';

interface Tool {
  id: string;
  name: string;
  type: string;
  size: string;
  material: string;
  brand: string;
  quantity: number;
  craft_type?: string;
  tool_category?: string;
  cable_length_mm?: number;
}

// Standard cable lengths for circular needles (mm → display label)
const CABLE_LENGTHS = [
  { mm: 229, label: '9" (23 cm)' },
  { mm: 305, label: '12" (30 cm)' },
  { mm: 406, label: '16" (40 cm)' },
  { mm: 508, label: '20" (50 cm)' },
  { mm: 610, label: '24" (60 cm)' },
  { mm: 737, label: '29" (74 cm)' },
  { mm: 813, label: '32" (80 cm)' },
  { mm: 914, label: '36" (90 cm)' },
  { mm: 1016, label: '40" (100 cm)' },
  { mm: 1194, label: '47" (120 cm)' },
  { mm: 1524, label: '60" (150 cm)' },
];

const EMPTY_FORM = {
  name: '',
  type: 'needle',
  size: '',
  material: '',
  brand: '',
  quantity: '1',
  craftType: 'knitting',
  toolCategory: '',
  cableLengthMm: '',
};

/** Derive tool_category from type */
function deriveToolCategory(type: string): string {
  switch (type) {
    case 'needle': return 'knitting_needle_straight';
    case 'circular': return 'knitting_needle_circular';
    case 'dpn': return 'knitting_needle_dpn';
    case 'hook': return 'crochet_hook';
    default: return 'accessory';
  }
}

/** Derive craft_type from type */
function deriveCraftType(type: string, fallback = 'knitting'): string {
  if (type === 'hook') return 'crochet';
  if (['needle', 'circular', 'dpn'].includes(type)) return 'knitting';
  return fallback;
}

export default function Tools() {
  const { data: tools = [], isLoading: loading } = useToolsQuery() as { data: Tool[] | undefined; isLoading: boolean };
  const createTool = useCreateTool();
  const updateToolMutation = useUpdateTool();
  const deleteToolMutation = useDeleteTool();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const handleTypeChange = (newType: string) => {
    setFormData((prev) => ({
      ...prev,
      type: newType,
      craftType: deriveCraftType(newType, prev.craftType),
      toolCategory: deriveToolCategory(newType),
      cableLengthMm: newType === 'circular' ? prev.cableLengthMm : '',
    }));
  };

  const closeAllModals = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingTool(null);
  }, []);

  useEscapeKey(closeAllModals, showCreateModal || showEditModal);

  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    createTool.mutate(formData, {
      onSuccess: () => {
        toast.success('Tool added successfully!');
        setShowCreateModal(false);
        setFormData({ ...EMPTY_FORM });
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to add tool');
      },
    });
  };

  const handleEditClick = (tool: Tool) => {
    setEditingTool(tool);
    setFormData({
      name: tool.name || '',
      type: tool.type || 'needle',
      size: tool.size || '',
      material: tool.material || '',
      brand: tool.brand || '',
      quantity: tool.quantity?.toString() || '1',
      craftType: tool.craft_type || deriveCraftType(tool.type || 'needle'),
      toolCategory: tool.tool_category || deriveToolCategory(tool.type || 'needle'),
      cableLengthMm: tool.cable_length_mm?.toString() || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTool) return;

    updateToolMutation.mutate({ id: editingTool.id, formData }, {
      onSuccess: () => {
        toast.success('Tool updated successfully!');
        setShowEditModal(false);
        setEditingTool(null);
        setFormData({ ...EMPTY_FORM });
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update tool');
      },
    });
  };

  const handleDeleteTool = async (id: string, _name: string) => {
    deleteToolMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Tool deleted successfully');
      },
      onError: () => {
        toast.error('Failed to delete tool');
      },
      onSettled: () => {
        setDeleteTarget(null);
      },
    });
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      needle: 'bg-blue-100 text-blue-800',
      hook: 'bg-purple-100 text-purple-800',
      circular: 'bg-green-100 text-green-800',
      dpn: 'bg-yellow-100 text-yellow-800',
      accessory: 'bg-gray-100 text-gray-800',
    };
    return colors[type?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading tools...</div>
      </div>
    );
  }

  /** Shared form fields for both create and edit modals */
  const renderFormFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tool Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="e.g., US 7 Circular Needles"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
          <select
            value={formData.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          >
            <option value="needle">Straight Needle</option>
            <option value="circular">Circular Needle</option>
            <option value="dpn">Double-Pointed Needles (DPN)</option>
            <option value="hook">Crochet Hook</option>
            <option value="accessory">Accessory</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Craft</label>
          <select
            value={formData.craftType}
            onChange={(e) => setFormData({ ...formData, craftType: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={['needle', 'circular', 'dpn', 'hook'].includes(formData.type)}
          >
            <option value="knitting">Knitting</option>
            <option value="crochet">Crochet</option>
          </select>
          {['needle', 'circular', 'dpn', 'hook'].includes(formData.type) && (
            <p className="text-xs text-gray-400 mt-1">Auto-set from tool type</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
          <input
            type="text"
            value={formData.size}
            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., US 7, 4.5mm"
          />
        </div>

        {formData.type === 'circular' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cable Length</label>
            <select
              value={formData.cableLengthMm}
              onChange={(e) => setFormData({ ...formData, cableLengthMm: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select length...</option>
              {CABLE_LENGTHS.map((cl) => (
                <option key={cl.mm} value={cl.mm}>{cl.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Material</label>
          <input
            type="text"
            value={formData.material}
            onChange={(e) => setFormData({ ...formData, material: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., Bamboo, Metal, Wood"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
          <input
            type="text"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., Clover, Addi"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
        <input
          type="number"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          min="1"
        />
      </div>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tools</h1>
          <p className="text-gray-600 mt-1">Manage your knitting tools inventory</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <FiPlus className="mr-2" />
          Add Tool
        </button>
      </div>

      {tools.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FiTool className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tools yet</h3>
          <p className="text-gray-500 mb-4">Start tracking your knitting tools</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Add Your First Tool
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <div key={tool.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
                  {tool.size && <p className="text-sm text-gray-600 mt-1">Size {tool.size}</p>}
                </div>
                {tool.type && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(tool.type)}`}>
                    {tool.type}
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {tool.brand && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Brand:</span> {tool.brand}
                  </div>
                )}
                {tool.material && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Material:</span> {tool.material}
                  </div>
                )}
                {tool.cable_length_mm != null && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Cable:</span>{' '}
                    {Math.round(Number(tool.cable_length_mm) / 25.4)}" ({Math.round(Number(tool.cable_length_mm) / 10)} cm)
                  </div>
                )}
                {tool.quantity && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Quantity:</span> {tool.quantity}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleEditClick(tool)}
                  className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition flex items-center justify-center text-sm"
                >
                  <FiEdit2 className="mr-2 h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: tool.id, name: tool.name })}
                  className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition flex items-center justify-center text-sm"
                >
                  <FiTrash2 className="mr-2 h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Tool Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Tool</h2>
            </div>
            <form onSubmit={handleCreateTool} className="p-6 space-y-4">
              {renderFormFields()}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                  Add Tool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tool Modal */}
      {showEditModal && editingTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Tool</h2>
            </div>
            <form onSubmit={handleUpdateTool} className="p-6 space-y-4">
              {renderFormFields()}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingTool(null); setFormData({ ...EMPTY_FORM }); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                  Update Tool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Tool"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteTool(deleteTarget.id, deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
