import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiMove } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface PatternSection {
  id: string;
  pattern_id: string;
  name: string;
  page_number: number | null;
  y_position: number | null;
  sort_order: number;
  parent_section_id: string | null;
  created_at: string;
}

interface PatternSectionsManagerProps {
  patternId: string;
  onClose: () => void;
}

export default function PatternSectionsManager({ patternId, onClose }: PatternSectionsManagerProps) {
  const [sections, setSections] = useState<PatternSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSection, setEditingSection] = useState<PatternSection | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    pageNumber: '',
    sortOrder: '',
  });

  useEffect(() => {
    fetchSections();
  }, [patternId]);

  const fetchSections = async () => {
    try {
      const response = await axios.get(`/api/patterns/${patternId}/sections`);
      setSections(response.data.data.sections || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
      toast.error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Section name is required');
      return;
    }

    try {
      const payload: any = {
        name: formData.name,
        sortOrder: sections.length,
      };

      if (formData.pageNumber) {
        payload.pageNumber = parseInt(formData.pageNumber);
      }

      await axios.post(`/api/patterns/${patternId}/sections`, payload);
      toast.success('Section created!');
      setShowForm(false);
      resetForm();
      fetchSections();
    } catch (error: any) {
      console.error('Error creating section:', error);
      toast.error(error.response?.data?.message || 'Failed to create section');
    }
  };

  const handleUpdate = async () => {
    if (!editingSection) return;

    if (!formData.name.trim()) {
      toast.error('Section name is required');
      return;
    }

    try {
      const payload: any = {
        name: formData.name,
      };

      if (formData.pageNumber) {
        payload.pageNumber = parseInt(formData.pageNumber);
      }

      if (formData.sortOrder) {
        payload.sortOrder = parseInt(formData.sortOrder);
      }

      await axios.put(`/api/patterns/${patternId}/sections/${editingSection.id}`, payload);
      toast.success('Section updated!');
      setEditingSection(null);
      resetForm();
      fetchSections();
    } catch (error: any) {
      console.error('Error updating section:', error);
      toast.error(error.response?.data?.message || 'Failed to update section');
    }
  };

  const handleDelete = async (sectionId: string, name: string) => {
    if (!confirm(`Delete section "${name}"?`)) return;

    try {
      await axios.delete(`/api/patterns/${patternId}/sections/${sectionId}`);
      toast.success('Section deleted');
      fetchSections();
    } catch (error) {
      console.error('Error deleting section:', error);
      toast.error('Failed to delete section');
    }
  };

  const handleEdit = (section: PatternSection) => {
    setEditingSection(section);
    setFormData({
      name: section.name,
      pageNumber: section.page_number?.toString() || '',
      sortOrder: section.sort_order.toString(),
    });
  };

  const handleMoveUp = async (section: PatternSection, index: number) => {
    if (index === 0) return;

    try {
      await axios.put(`/api/patterns/${patternId}/sections/${section.id}`, {
        sortOrder: index - 1,
      });
      fetchSections();
    } catch (error) {
      toast.error('Failed to reorder section');
    }
  };

  const handleMoveDown = async (section: PatternSection, index: number) => {
    if (index === sections.length - 1) return;

    try {
      await axios.put(`/api/patterns/${patternId}/sections/${section.id}`, {
        sortOrder: index + 1,
      });
      fetchSections();
    } catch (error) {
      toast.error('Failed to reorder section');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      pageNumber: '',
      sortOrder: '',
    });
    setShowForm(false);
    setEditingSection(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Pattern Sections</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading sections...</p>
            </div>
          ) : (
            <>
              {/* Sections List */}
              {sections.length === 0 && !showForm && !editingSection ? (
                <div className="text-center py-12">
                  <FiMove className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No sections yet</h3>
                  <p className="text-gray-500 mb-6">
                    Organize your pattern into sections like "Body", "Sleeves", "Finishing", etc.
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition inline-flex items-center gap-2"
                  >
                    <FiPlus className="h-5 w-5" />
                    Create First Section
                  </button>
                </div>
              ) : (
                <>
                  {!showForm && !editingSection && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition inline-flex items-center gap-2"
                      >
                        <FiPlus className="h-4 w-4" />
                        New Section
                      </button>
                    </div>
                  )}

                  {/* Section Form */}
                  {(showForm || editingSection) && (
                    <div className="mb-6 p-4 border border-purple-200 rounded-lg bg-purple-50">
                      <h3 className="font-semibold text-gray-900 mb-4">
                        {editingSection ? 'Edit Section' : 'New Section'}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Section Name *
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Body, Sleeves, Finishing"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Page Number (optional)
                          </label>
                          <input
                            type="number"
                            value={formData.pageNumber}
                            onChange={(e) => setFormData({ ...formData, pageNumber: e.target.value })}
                            placeholder="e.g., 5"
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Link this section to a specific page in the pattern
                          </p>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={resetForm}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={editingSection ? handleUpdate : handleCreate}
                            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                          >
                            {editingSection ? 'Update' : 'Create'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sections List */}
                  {sections.length > 0 && (
                    <div className="space-y-2">
                      {sections.map((section, index) => (
                        <div
                          key={section.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{section.name}</h4>
                              {section.page_number && (
                                <p className="text-sm text-gray-500 mt-1">Page {section.page_number}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => handleMoveUp(section, index)}
                                disabled={index === 0}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => handleMoveDown(section, index)}
                                disabled={index === sections.length - 1}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => handleEdit(section)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <FiEdit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(section.id, section.name)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
