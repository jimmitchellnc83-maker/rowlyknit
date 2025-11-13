import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiPackage, FiEdit2 } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Yarn {
  id: string;
  brand: string;
  name: string;
  color: string;
  weight: string;
  yards_remaining: number;
  skeins_remaining: number;
  fiber_content: string;
  yards_total?: number;
  skeins_total?: number;
  low_stock_threshold?: number;
  low_stock_alert?: boolean;
}

export default function YarnStash() {
  const [yarn, setYarn] = useState<Yarn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingYarn, setEditingYarn] = useState<Yarn | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    name: '',
    color: '',
    weight: 'worsted',
    fiberContent: '',
    yardsTotal: '',
    skeinsTotal: '1',
    lowStockThreshold: '',
    lowStockAlert: false,
  });

  useEffect(() => {
    fetchYarn();
  }, []);

  const fetchYarn = async () => {
    try {
      const response = await axios.get('/api/yarn');
      setYarn(response.data.data.yarn);
    } catch (error: any) {
      console.error('Error fetching yarn:', error);
      toast.error('Failed to load yarn');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateYarn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/yarn', formData);
      toast.success('Yarn added successfully!');
      setShowCreateModal(false);
      setFormData({
        brand: '',
        name: '',
        color: '',
        weight: 'worsted',
        fiberContent: '',
        yardsTotal: '',
        skeinsTotal: '1',
      });
      fetchYarn();
    } catch (error: any) {
      console.error('Error creating yarn:', error);
      toast.error(error.response?.data?.message || 'Failed to add yarn');
    }
  };

  const handleEditClick = (y: Yarn) => {
    setEditingYarn(y);
    setFormData({
      brand: y.brand || '',
      name: y.name || '',
      color: y.color || '',
      weight: y.weight || 'worsted',
      fiberContent: y.fiber_content || '',
      yardsTotal: y.yards_total?.toString() || '',
      skeinsTotal: y.skeins_total?.toString() || '1',
      lowStockThreshold: y.low_stock_threshold?.toString() || '',
      lowStockAlert: y.low_stock_alert || false,
    });
    setShowEditModal(true);
  };

  const handleUpdateYarn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYarn) return;

    try {
      await axios.put(`/api/yarn/${editingYarn.id}`, formData);
      toast.success('Yarn updated successfully!');
      setShowEditModal(false);
      setEditingYarn(null);
      setFormData({
        brand: '',
        name: '',
        color: '',
        weight: 'worsted',
        fiberContent: '',
        yardsTotal: '',
        skeinsTotal: '1',
        lowStockThreshold: '',
        lowStockAlert: false,
      });
      fetchYarn();
    } catch (error: any) {
      console.error('Error updating yarn:', error);
      toast.error(error.response?.data?.message || 'Failed to update yarn');
    }
  };

  const handleDeleteYarn = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    try {
      await axios.delete(`/api/yarn/${id}`);
      toast.success('Yarn deleted successfully');
      fetchYarn();
    } catch (error: any) {
      console.error('Error deleting yarn:', error);
      toast.error('Failed to delete yarn');
    }
  };

  const getWeightColor = (weight: string) => {
    const colors: { [key: string]: string } = {
      lace: 'bg-purple-100 text-purple-800',
      fingering: 'bg-blue-100 text-blue-800',
      sport: 'bg-green-100 text-green-800',
      dk: 'bg-yellow-100 text-yellow-800',
      worsted: 'bg-orange-100 text-orange-800',
      bulky: 'bg-red-100 text-red-800',
    };
    return colors[weight?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading yarn stash...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Yarn Stash</h1>
          <p className="text-gray-600 mt-1">Manage your yarn inventory</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <FiPlus className="mr-2" />
          Add Yarn
        </button>
      </div>

      {yarn.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FiPackage className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No yarn in stash</h3>
          <p className="text-gray-500 mb-4">Start tracking your yarn collection</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Add Your First Yarn
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {yarn.map((y) => (
            <div
              key={y.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {y.brand && `${y.brand} `}{y.name}
                  </h3>
                  {y.color && (
                    <p className="text-sm text-gray-600 mt-1">{y.color}</p>
                  )}
                </div>
                {y.weight && (
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getWeightColor(
                      y.weight
                    )}`}
                  >
                    {y.weight}
                  </span>
                )}
              </div>

              {y.fiber_content && (
                <p className="text-sm text-gray-500 mb-3">{y.fiber_content}</p>
              )}

              <div className="space-y-2 mb-4">
                {y.skeins_remaining !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Skeins:</span>
                    <span className="font-medium text-gray-900">{y.skeins_remaining}</span>
                  </div>
                )}
                {y.yards_remaining !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Yards:</span>
                    <span className="font-medium text-gray-900">{y.yards_remaining}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleEditClick(y)}
                  className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition flex items-center justify-center text-sm"
                >
                  <FiEdit2 className="mr-2 h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteYarn(y.id, y.name)}
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

      {/* Create Yarn Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Yarn to Stash</h2>
            </div>

            <form onSubmit={handleCreateYarn} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Lion Brand"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yarn Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Wool-Ease"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Navy Blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight
                  </label>
                  <select
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="lace">Lace</option>
                    <option value="fingering">Fingering</option>
                    <option value="sport">Sport</option>
                    <option value="dk">DK</option>
                    <option value="worsted">Worsted</option>
                    <option value="bulky">Bulky</option>
                    <option value="super-bulky">Super Bulky</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fiber Content
                </label>
                <input
                  type="text"
                  value={formData.fiberContent}
                  onChange={(e) => setFormData({ ...formData, fiberContent: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., 100% Wool, 80% Acrylic 20% Wool"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Skeins
                  </label>
                  <input
                    type="number"
                    value={formData.skeinsTotal}
                    onChange={(e) => setFormData({ ...formData, skeinsTotal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yards per Skein
                  </label>
                  <input
                    type="number"
                    value={formData.yardsTotal}
                    onChange={(e) => setFormData({ ...formData, yardsTotal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 364"
                  />
                </div>
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
                  Add to Stash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Yarn Modal */}
      {showEditModal && editingYarn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Yarn</h2>
            </div>

            <form onSubmit={handleUpdateYarn} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Lion Brand"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yarn Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Wool-Ease"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Navy Blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight
                  </label>
                  <select
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="lace">Lace</option>
                    <option value="fingering">Fingering</option>
                    <option value="sport">Sport</option>
                    <option value="dk">DK</option>
                    <option value="worsted">Worsted</option>
                    <option value="bulky">Bulky</option>
                    <option value="super-bulky">Super Bulky</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fiber Content
                </label>
                <input
                  type="text"
                  value={formData.fiberContent}
                  onChange={(e) => setFormData({ ...formData, fiberContent: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., 100% Wool, 80% Acrylic 20% Wool"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Skeins
                  </label>
                  <input
                    type="number"
                    value={formData.skeinsTotal}
                    onChange={(e) => setFormData({ ...formData, skeinsTotal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yards per Skein
                  </label>
                  <input
                    type="number"
                    value={formData.yardsTotal}
                    onChange={(e) => setFormData({ ...formData, yardsTotal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 364"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Low Stock Alerts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Low Stock Threshold (yards)
                    </label>
                    <input
                      type="number"
                      value={formData.lowStockThreshold}
                      onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., 100"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Get notified when yards drop below this amount</p>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lowStockAlert}
                        onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.checked })}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Enable low stock alerts</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingYarn(null);
                    setFormData({
                      brand: '',
                      name: '',
                      color: '',
                      weight: 'worsted',
                      fiberContent: '',
                      yardsTotal: '',
                      skeinsTotal: '1',
                      lowStockThreshold: '',
                      lowStockAlert: false,
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
                  Update Yarn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
