import { useState, useEffect } from 'react';
import { FiBookmark, FiPlus, FiX, FiEdit2, FiTrash2, FiChevronRight } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Bookmark {
  id: string;
  pattern_id: string;
  project_id: string | null;
  name: string;
  page_number: number;
  y_position: number | null;
  zoom_level: number;
  notes: string | null;
  color: string;
  sort_order: number;
  created_at: string;
}

interface BookmarkManagerProps {
  patternId: string;
  projectId?: string;
  currentPage?: number;
  currentZoom?: number;
  onJumpToBookmark: (bookmark: Bookmark) => void;
}

const BOOKMARK_COLORS = [
  { name: 'Yellow', value: '#FBBF24' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
];

export default function BookmarkManager({
  patternId,
  projectId,
  currentPage = 1,
  currentZoom = 1.0,
  onJumpToBookmark,
}: BookmarkManagerProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    pageNumber: currentPage,
    notes: '',
    color: '#FBBF24',
  });

  useEffect(() => {
    fetchBookmarks();
  }, [patternId, projectId]);

  const fetchBookmarks = async () => {
    try {
      const params = projectId ? { projectId } : {};
      const response = await axios.get(`/api/patterns/${patternId}/bookmarks`, { params });
      setBookmarks(response.data.data.bookmarks);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    }
  };

  const handleCreateBookmark = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a bookmark name');
      return;
    }

    try {
      await axios.post(`/api/patterns/${patternId}/bookmarks`, {
        name: formData.name,
        pageNumber: formData.pageNumber,
        zoomLevel: currentZoom,
        notes: formData.notes || null,
        color: formData.color,
        projectId: projectId || null,
      });

      toast.success('Bookmark created!');
      setShowCreateModal(false);
      resetForm();
      fetchBookmarks();
    } catch (error: any) {
      console.error('Error creating bookmark:', error);
      toast.error(error.response?.data?.message || 'Failed to create bookmark');
    }
  };

  const handleUpdateBookmark = async () => {
    if (!editingBookmark) return;

    try {
      await axios.put(`/api/patterns/${patternId}/bookmarks/${editingBookmark.id}`, {
        name: formData.name,
        pageNumber: formData.pageNumber,
        notes: formData.notes || null,
        color: formData.color,
      });

      toast.success('Bookmark updated!');
      setEditingBookmark(null);
      resetForm();
      fetchBookmarks();
    } catch (error: any) {
      console.error('Error updating bookmark:', error);
      toast.error(error.response?.data?.message || 'Failed to update bookmark');
    }
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    if (!confirm('Delete this bookmark?')) return;

    try {
      await axios.delete(`/api/patterns/${patternId}/bookmarks/${bookmarkId}`);
      toast.success('Bookmark deleted');
      fetchBookmarks();
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast.error('Failed to delete bookmark');
    }
  };

  const handleQuickBookmark = async () => {
    try {
      await axios.post(`/api/patterns/${patternId}/bookmarks`, {
        name: `Page ${currentPage}`,
        pageNumber: currentPage,
        zoomLevel: currentZoom,
        color: '#FBBF24',
        projectId: projectId || null,
      });

      toast.success(`Bookmark added for page ${currentPage}!`);
      fetchBookmarks();
    } catch (error) {
      console.error('Error creating quick bookmark:', error);
      toast.error('Failed to create bookmark');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      pageNumber: currentPage,
      notes: '',
      color: '#FBBF24',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (bookmark: Bookmark) => {
    setFormData({
      name: bookmark.name,
      pageNumber: bookmark.page_number,
      notes: bookmark.notes || '',
      color: bookmark.color,
    });
    setEditingBookmark(bookmark);
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiBookmark className="h-5 w-5 text-yellow-400" />
          <h3 className="text-white font-semibold">Bookmarks</h3>
          <span className="text-gray-400 text-sm">({bookmarks.length})</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickBookmark}
            className="p-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm"
            title="Quick bookmark current page"
          >
            <FiPlus className="h-4 w-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm flex items-center gap-2"
          >
            <FiPlus className="h-4 w-4" />
            New
          </button>
        </div>
      </div>

      {/* Bookmarks List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {bookmarks.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No bookmarks yet</p>
        ) : (
          bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 cursor-pointer group"
            >
              {/* Color indicator */}
              <div
                className="w-1 h-12 rounded-full flex-shrink-0"
                style={{ backgroundColor: bookmark.color }}
              />

              {/* Bookmark info */}
              <div
                className="flex-1 min-w-0"
                onClick={() => onJumpToBookmark(bookmark)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-white font-medium truncate">{bookmark.name}</h4>
                  <FiChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>Page {bookmark.page_number}</span>
                  {bookmark.notes && (
                    <span className="truncate max-w-xs">{bookmark.notes}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(bookmark);
                  }}
                  className="p-1.5 hover:bg-gray-600 rounded text-blue-400"
                  title="Edit bookmark"
                >
                  <FiEdit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBookmark(bookmark.id);
                  }}
                  className="p-1.5 hover:bg-gray-600 rounded text-red-400"
                  title="Delete bookmark"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingBookmark) && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {editingBookmark ? 'Edit Bookmark' : 'New Bookmark'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingBookmark(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bookmark Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Current row, Sleeve decreases"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Page Number
                </label>
                <input
                  type="number"
                  value={formData.pageNumber}
                  onChange={(e) => setFormData({ ...formData, pageNumber: parseInt(e.target.value) })}
                  min={1}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {BOOKMARK_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-full h-10 rounded border-2 ${
                        formData.color === color.value
                          ? 'border-white'
                          : 'border-gray-600 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes or instructions"
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingBookmark(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={editingBookmark ? handleUpdateBookmark : handleCreateBookmark}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                >
                  {editingBookmark ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
