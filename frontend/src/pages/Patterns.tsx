import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiBook, FiEdit2, FiSearch, FiX } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { PDFCollation } from '../components/patterns';

interface Pattern {
  id: string;
  name: string;
  description: string;
  designer: string;
  difficulty: string;
  category: string;
  created_at: string;
}

export default function Patterns() {
  const navigate = useNavigate();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCollationModal, setShowCollationModal] = useState(false);
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [patternFiles, setPatternFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    designer: '',
    difficulty: 'intermediate',
    category: 'sweater',
  });

  useEffect(() => {
    fetchPatterns();
  }, []);

  const fetchPatterns = async () => {
    try {
      const response = await axios.get('/api/patterns');
      setPatterns(response.data.data.patterns);
    } catch (error: any) {
      console.error('Error fetching patterns:', error);
      toast.error('Failed to load patterns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePattern = async (e: React.FormEvent) => {
    e.preventDefault();

    setUploadingFiles(true);

    try {
      // Step 1: Create the pattern
      const createResponse = await axios.post('/api/patterns', formData);
      const newPattern = createResponse.data.data.pattern;
      toast.success('Pattern created!');

      // Step 2: Upload PDF files if any
      if (patternFiles.length > 0) {
        let uploadedCount = 0;
        for (const file of patternFiles) {
          try {
            const fileFormData = new FormData();
            fileFormData.append('file', file);

            await axios.post(`/api/uploads/patterns/${newPattern.id}/files`, fileFormData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });
            uploadedCount++;
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
          }
        }

        if (uploadedCount === patternFiles.length) {
          toast.success(`Pattern created with ${uploadedCount} PDF${uploadedCount > 1 ? 's' : ''}!`);
        } else {
          toast.warning(`Pattern created but only ${uploadedCount}/${patternFiles.length} files uploaded`);
        }
      }

      // Reset and close
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        designer: '',
        difficulty: 'intermediate',
        category: 'sweater',
      });
      setPatternFiles([]);
      fetchPatterns();
    } catch (error: any) {
      console.error('Error creating pattern:', error);
      toast.error(error.response?.data?.message || 'Failed to create pattern');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleEditClick = (pattern: Pattern) => {
    setEditingPattern(pattern);
    setFormData({
      name: pattern.name || '',
      description: pattern.description || '',
      designer: pattern.designer || '',
      difficulty: pattern.difficulty || 'intermediate',
      category: pattern.category || 'sweater',
    });
    setShowEditModal(true);
  };

  const handleUpdatePattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPattern) return;

    try {
      await axios.put(`/api/patterns/${editingPattern.id}`, formData);
      toast.success('Pattern updated successfully!');
      setShowEditModal(false);
      setEditingPattern(null);
      setFormData({
        name: '',
        description: '',
        designer: '',
        difficulty: 'intermediate',
        category: 'sweater',
      });
      fetchPatterns();
    } catch (error: any) {
      console.error('Error updating pattern:', error);
      toast.error(error.response?.data?.message || 'Failed to update pattern');
    }
  };

  const handleDeletePattern = async (id: string, name: string) => {
    if (deletingId) return;
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    setDeletingId(id);
    try {
      await axios.delete(`/api/patterns/${id}`);
      toast.success('Pattern deleted successfully');
      fetchPatterns();
    } catch (error) {
      console.error('Error deleting pattern:', error);
      toast.error('Failed to delete pattern');
    } finally {
      setDeletingId(null);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter and search patterns
  const filteredPatterns = useMemo(() => {
    return patterns.filter((pattern) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        pattern.name.toLowerCase().includes(searchLower) ||
        pattern.description?.toLowerCase().includes(searchLower) ||
        pattern.designer?.toLowerCase().includes(searchLower) ||
        pattern.category?.toLowerCase().includes(searchLower);

      // Difficulty filter
      const matchesDifficulty =
        difficultyFilter === 'all' || pattern.difficulty === difficultyFilter;

      // Category filter
      const matchesCategory =
        categoryFilter === 'all' || pattern.category === categoryFilter;

      return matchesSearch && matchesDifficulty && matchesCategory;
    });
  }, [patterns, searchQuery, difficultyFilter, categoryFilter]);

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    const cats = new Set(patterns.map((p) => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [patterns]);

  const clearFilters = () => {
    setSearchQuery('');
    setDifficultyFilter('all');
    setCategoryFilter('all');
  };

  const hasActiveFilters = searchQuery || difficultyFilter !== 'all' || categoryFilter !== 'all';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading patterns...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patterns</h1>
          <p className="text-gray-600 mt-1">Manage your knitting pattern library</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCollationModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            disabled={patterns.length === 0}
          >
            <FiBook className="mr-2" />
            Merge PDFs
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            New Pattern
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      {patterns.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search patterns, designers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Difficulty Filter */}
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                <FiX className="mr-2" />
                Clear
              </button>
            )}
          </div>

          {/* Results count */}
          {hasActiveFilters && (
            <div className="mt-3 text-sm text-gray-600">
              Showing {filteredPatterns.length} of {patterns.length} patterns
            </div>
          )}
        </div>
      )}

      {patterns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FiBook className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No patterns yet</h3>
          <p className="text-gray-500 mb-4">Start building your pattern library</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Add Your First Pattern
          </button>
        </div>
      ) : filteredPatterns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FiSearch className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matching patterns</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
          <button
            onClick={clearFilters}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiX className="mr-2" />
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition"
            >
              {/* Clickable card area */}
              <div
                onClick={() => navigate(`/patterns/${pattern.id}`)}
                className="cursor-pointer p-6 pb-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1 hover:text-purple-600 transition">
                    {pattern.name}
                  </h3>
                  {pattern.difficulty && (
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(
                        pattern.difficulty
                      )}`}
                    >
                      {pattern.difficulty}
                    </span>
                  )}
                </div>

                {pattern.designer && (
                  <p className="text-sm text-gray-600 mb-2">by {pattern.designer}</p>
                )}

                {pattern.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {pattern.description}
                  </p>
                )}

                {pattern.category && (
                  <div className="text-sm text-gray-500 mb-2">
                    Category: {pattern.category}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(pattern);
                    }}
                    className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition flex items-center justify-center text-sm"
                  >
                    <FiEdit2 className="mr-2 h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePattern(pattern.id, pattern.name);
                    }}
                    disabled={deletingId === pattern.id}
                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === pattern.id ? (
                      <>
                        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent inline-block" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <FiTrash2 className="mr-2 h-4 w-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Pattern Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add New Pattern</h2>
            </div>

            <form onSubmit={handleCreatePattern} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pattern Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Classic Raglan Sweater"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Designer
                </label>
                <input
                  type="text"
                  value={formData.designer}
                  onChange={(e) => setFormData({ ...formData, designer: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Pattern designer name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="sweater">Sweater</option>
                    <option value="scarf">Scarf</option>
                    <option value="hat">Hat</option>
                    <option value="blanket">Blanket</option>
                    <option value="socks">Socks</option>
                    <option value="shawl">Shawl</option>
                    <option value="toy">Toy/Amigurumi</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Pattern details, notes, etc."
                />
              </div>

              {/* PDF Upload */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pattern PDF Files (Optional)
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Upload one or more PDF files for this pattern
                </p>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setPatternFiles(Array.from(e.target.files));
                    }
                  }}
                  disabled={uploadingFiles}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {patternFiles.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-medium text-gray-700">
                      Selected files ({patternFiles.length}):
                    </p>
                    {patternFiles.map((file, index) => (
                      <div key={index} className="text-sm text-gray-600 flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                        <span>{file.name}</span>
                        <span className="text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setPatternFiles([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  disabled={uploadingFiles}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={uploadingFiles}
                >
                  {uploadingFiles ? 'Creating & Uploading...' : 'Add Pattern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pattern Modal */}
      {showEditModal && editingPattern && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Pattern</h2>
            </div>

            <form onSubmit={handleUpdatePattern} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pattern Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Classic Raglan Sweater"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Designer
                </label>
                <input
                  type="text"
                  value={formData.designer}
                  onChange={(e) => setFormData({ ...formData, designer: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Pattern designer name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="sweater">Sweater</option>
                    <option value="scarf">Scarf</option>
                    <option value="hat">Hat</option>
                    <option value="blanket">Blanket</option>
                    <option value="socks">Socks</option>
                    <option value="shawl">Shawl</option>
                    <option value="toy">Toy/Amigurumi</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Pattern details, notes, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPattern(null);
                    setFormData({
                      name: '',
                      description: '',
                      designer: '',
                      difficulty: 'intermediate',
                      category: 'sweater',
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
                  Update Pattern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Collation Modal */}
      {showCollationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Merge Pattern PDFs</h2>
              <button
                onClick={() => setShowCollationModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <PDFCollation />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
