import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiUsers, FiEdit2 } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  clothing_size: string;
  notes: string;
}

export default function Recipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    relationship: '',
    clothingSize: '',
    notes: '',
  });

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      const response = await axios.get('/api/recipients');
      setRecipients(response.data.data.recipients);
    } catch (error: any) {
      console.error('Error fetching recipients:', error);
      toast.error('Failed to load recipients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/recipients', formData);
      toast.success('Recipient added successfully!');
      setShowCreateModal(false);
      setFormData({
        firstName: '',
        lastName: '',
        relationship: '',
        clothingSize: '',
        notes: '',
      });
      fetchRecipients();
    } catch (error: any) {
      console.error('Error creating recipient:', error);
      toast.error(error.response?.data?.message || 'Failed to add recipient');
    }
  };

  const handleEditClick = (recipient: Recipient) => {
    setEditingRecipient(recipient);
    setFormData({
      firstName: recipient.first_name || '',
      lastName: recipient.last_name || '',
      relationship: recipient.relationship || '',
      clothingSize: recipient.clothing_size || '',
      notes: recipient.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipient) return;

    try {
      await axios.put(`/api/recipients/${editingRecipient.id}`, formData);
      toast.success('Recipient updated successfully!');
      setShowEditModal(false);
      setEditingRecipient(null);
      setFormData({
        firstName: '',
        lastName: '',
        relationship: '',
        clothingSize: '',
        notes: '',
      });
      fetchRecipients();
    } catch (error: any) {
      console.error('Error updating recipient:', error);
      toast.error(error.response?.data?.message || 'Failed to update recipient');
    }
  };

  const handleDeleteRecipient = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    try {
      await axios.delete(`/api/recipients/${id}`);
      toast.success('Recipient deleted successfully');
      fetchRecipients();
    } catch (error: any) {
      console.error('Error deleting recipient:', error);
      toast.error('Failed to delete recipient');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading recipients...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipients</h1>
          <p className="text-gray-600 mt-1">Manage gift recipients and their preferences</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <FiPlus className="mr-2" />
          Add Recipient
        </button>
      </div>

      {recipients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FiUsers className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recipients yet</h3>
          <p className="text-gray-500 mb-4">Start tracking people you knit for</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Add Your First Recipient
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipients.map((recipient) => (
            <div
              key={recipient.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {recipient.first_name} {recipient.last_name}
              </h3>

              {recipient.relationship && (
                <p className="text-sm text-gray-600 mb-3">{recipient.relationship}</p>
              )}

              {recipient.clothing_size && (
                <div className="text-sm text-gray-500 mb-2">
                  <span className="font-medium">Size:</span> {recipient.clothing_size}
                </div>
              )}

              {recipient.notes && (
                <p className="text-sm text-gray-600 mt-3 line-clamp-2">{recipient.notes}</p>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200 mt-4">
                <button
                  onClick={() => handleEditClick(recipient)}
                  className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition flex items-center justify-center text-sm"
                >
                  <FiEdit2 className="mr-2 h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() =>
                    handleDeleteRecipient(
                      recipient.id,
                      `${recipient.first_name} ${recipient.last_name}`
                    )
                  }
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

      {/* Create Recipient Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Recipient</h2>
            </div>

            <form onSubmit={handleCreateRecipient} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Friend, Family, Child"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clothing Size
                  </label>
                  <input
                    type="text"
                    value={formData.clothingSize}
                    onChange={(e) => setFormData({ ...formData, clothingSize: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Medium, Large"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Preferences, measurements, color likes/dislikes, etc."
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
                  Add Recipient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Recipient Modal */}
      {showEditModal && editingRecipient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Recipient</h2>
            </div>

            <form onSubmit={handleUpdateRecipient} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Friend, Family, Child"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clothing Size
                  </label>
                  <input
                    type="text"
                    value={formData.clothingSize}
                    onChange={(e) => setFormData({ ...formData, clothingSize: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Medium, Large"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Preferences, measurements, color likes/dislikes, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRecipient(null);
                    setFormData({
                      firstName: '',
                      lastName: '',
                      relationship: '',
                      clothingSize: '',
                      notes: '',
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
                  Update Recipient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
