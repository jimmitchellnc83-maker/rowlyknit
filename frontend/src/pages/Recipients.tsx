import { useState, useMemo, useCallback, useRef } from 'react';
import { FiPlus, FiTrash2, FiUsers, FiEdit2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import ConfirmModal from '../components/ConfirmModal';
import ListControls, { applyListControls, type SortOption } from '../components/ListControls';
import { LoadingCardGrid, ErrorState } from '../components/LoadingSpinner';
import { useRecipients, useCreateRecipient, useUpdateRecipient, useDeleteRecipient } from '../hooks/useApi';

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  clothing_size: string;
  notes: string;
}

const nameKey = (r: Recipient) => `${(r.last_name || '').toLowerCase()} ${(r.first_name || '').toLowerCase()}`;

const SORT_OPTIONS: SortOption<Recipient>[] = [
  { id: 'name_asc', label: 'Name (A–Z)', compare: (a, b) => nameKey(a).localeCompare(nameKey(b)) },
  { id: 'name_desc', label: 'Name (Z–A)', compare: (a, b) => nameKey(b).localeCompare(nameKey(a)) },
];

export default function Recipients() {
  const {
    data: recipients = [],
    isLoading: loading,
    isError,
    refetch,
  } = useRecipients() as {
    data: Recipient[] | undefined;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
  const createRecipient = useCreateRecipient();
  const updateRecipientMutation = useUpdateRecipient();
  const deleteRecipientMutation = useDeleteRecipient();
  const [search, setSearch] = useState('');
  const [sortId, setSortId] = useState<string>('name_asc');
  const visibleRecipients = useMemo(
    () =>
      applyListControls(recipients, {
        search,
        searchFields: (r) => [r.first_name, r.last_name, r.relationship, r.notes],
        sort: SORT_OPTIONS.find((s) => s.id === sortId),
      }),
    [recipients, search, sortId],
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    relationship: '',
    clothingSize: '',
    notes: '',
  });

  const closeAllModals = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingRecipient(null);
  }, []);
  useEscapeKey(closeAllModals, showCreateModal || showEditModal);
  const createModalRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(createModalRef, showCreateModal);
  useFocusTrap(editModalRef, showEditModal && !!editingRecipient);

  const handleCreateRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    createRecipient.mutate(formData, {
      onSuccess: () => {
        toast.success('Recipient added successfully!');
        setShowCreateModal(false);
        setFormData({
          firstName: '',
          lastName: '',
          relationship: '',
          clothingSize: '',
          notes: '',
        });
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to add recipient');
      },
    });
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

    updateRecipientMutation.mutate({ id: editingRecipient.id, formData }, {
      onSuccess: () => {
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
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update recipient');
      },
    });
  };

  const handleDeleteRecipient = async (id: string, _name: string) => {
    deleteRecipientMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Recipient deleted successfully');
      },
      onError: () => {
        toast.error('Failed to delete recipient');
      },
      onSettled: () => {
        setDeleteTarget(null);
      },
    });
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Recipients</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage gift recipients and their preferences</p>
          </div>
        </div>
        <LoadingCardGrid />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Recipients</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage gift recipients and their preferences</p>
          </div>
        </div>
        <ErrorState
          title="Couldn't load your recipients"
          message="We hit an error fetching your recipients. Check your connection and try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Recipients</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage gift recipients and their preferences</p>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiUsers className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No recipients yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Start tracking people you knit for</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Add Your First Recipient
          </button>
        </div>
      ) : (
        <>
        <ListControls
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search recipients…"
          sortOptions={SORT_OPTIONS}
          sortValue={sortId}
          onSortChange={setSortId}
          resultCount={visibleRecipients.length}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleRecipients.map((recipient) => (
            <div
              key={recipient.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {recipient.first_name} {recipient.last_name}
              </h3>

              {recipient.relationship && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{recipient.relationship}</p>
              )}

              {recipient.clothing_size && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span className="font-medium">Size:</span> {recipient.clothing_size}
                </div>
              )}

              {recipient.notes && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">{recipient.notes}</p>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                <button
                  onClick={() => handleEditClick(recipient)}
                  className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition flex items-center justify-center text-sm"
                >
                  <FiEdit2 className="mr-2 h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() =>
                    setDeleteTarget({ id: recipient.id, name: `${recipient.first_name} ${recipient.last_name}` })
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
        </>
      )}

      {/* Create Recipient Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-recipient-title"
        >
          <div ref={createModalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 id="create-recipient-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add Recipient</h2>
            </div>

            <form onSubmit={handleCreateRecipient} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Friend, Family, Child"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Clothing Size
                  </label>
                  <input
                    type="text"
                    value={formData.clothingSize}
                    onChange={(e) => setFormData({ ...formData, clothingSize: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Medium, Large"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Preferences, measurements, color likes/dislikes, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createRecipient.isPending}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRecipient.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {createRecipient.isPending ? 'Adding…' : 'Add Recipient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Recipient Modal */}
      {showEditModal && editingRecipient && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-recipient-title"
        >
          <div ref={editModalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 id="edit-recipient-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Recipient</h2>
            </div>

            <form onSubmit={handleUpdateRecipient} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Friend, Family, Child"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Clothing Size
                  </label>
                  <input
                    type="text"
                    value={formData.clothingSize}
                    onChange={(e) => setFormData({ ...formData, clothingSize: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Medium, Large"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  disabled={updateRecipientMutation.isPending}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateRecipientMutation.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updateRecipientMutation.isPending ? 'Updating…' : 'Update Recipient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Recipient"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteRecipient(deleteTarget.id, deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
