import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiTool, FiEdit2 } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Tool {
  id: string;
  name: string;
  type: string;
  size: string;
  material: string;
  brand: string;
  quantity: number;
}

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'needle',
    size: '',
    material: '',
    brand: '',
    quantity: '1',
  });

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await axios.get('/api/tools');
      setTools(response.data.data.tools);
    } catch (error: any) {
      console.error('Error fetching tools:', error);
      toast.error('Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/tools', formData);
      toast.success('Tool added successfully!');
      setShowCreateModal(false);
      setFormData({
        name: '',
        type: 'needle',
        size: '',
        material: '',
        brand: '',
        quantity: '1',
      });
      fetchTools();
    } catch (error: any) {
      console.error('Error creating tool:', error);
      toast.error(error.response?.data?.message || 'Failed to add tool');
    }
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
    });
    setShowEditModal(true);
  };

  const handleUpdateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTool) return;

    try {
      await axios.put(`/api/tools/${editingTool.id}`, formData);
      toast.success('Tool updated successfully!');
      setShowEditModal(false);
      setEditingTool(null);
      setFormData({
        name: '',
        type: 'needle',
        size: '',
        material: '',
        brand: '',
        quantity: '1',
      });
      fetchTools();
    } catch (error: any) {
      console.error('Error updating tool:', error);
      toast.error(error.response?.data?.message || 'Failed to update tool');
    }
  };

  const handleDeleteTool = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    try {
      await axios.delete(`/api/tools/${id}`);
      toast.success('Tool deleted successfully');
      fetchTools();
    } catch (error: any) {
      console.error('Error deleting tool:', error);
      toast.error('Failed to delete tool');
    }
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
            <div
              key={tool.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
                  {tool.size && <p className="text-sm text-gray-600 mt-1">Size {tool.size}</p>}
                </div>
                {tool.type && (
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(
                      tool.type
                    )}`}
                  >
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
                  onClick={() => handleDeleteTool(tool.id, tool.name)}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tool Name *
                </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
                  <input
                    type="text"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., US 7, 4.5mm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Material
                  </label>
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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tool Name *
                </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
                  <input
                    type="text"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., US 7, 4.5mm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Material
                  </label>
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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingTool(null);
                    setFormData({
                      name: '',
                      type: 'needle',
                      size: '',
                      material: '',
                      brand: '',
                      quantity: '1',
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Update Tool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
