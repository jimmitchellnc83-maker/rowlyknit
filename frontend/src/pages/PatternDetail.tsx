import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2 } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import PatternFileUpload from '../components/PatternFileUpload';

interface Pattern {
  id: string;
  name: string;
  description: string;
  designer: string;
  difficulty: string;
  category: string;
  yarn_requirements?: string;
  needle_size?: string;
  gauge?: string;
  sizes_available?: string;
  notes?: string;
  tags?: string[];
  is_favorite?: boolean;
  times_used?: number;
  created_at: string;
  updated_at: string;
}

interface PatternFile {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  mime_type: string;
  size: number;
  file_type: 'pdf' | 'image' | 'document' | 'other';
  description?: string;
  created_at: string;
}

export default function PatternDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [files, setFiles] = useState<PatternFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    designer: '',
    difficulty: 'intermediate',
    category: 'sweater',
    yarnRequirements: '',
    needleSize: '',
    gauge: '',
    sizesAvailable: '',
    notes: '',
  });

  useEffect(() => {
    if (id) {
      fetchPattern();
      fetchPatternFiles();
    }
  }, [id]);

  const fetchPattern = async () => {
    try {
      const response = await axios.get(`/api/patterns/${id}`);
      setPattern(response.data.data.pattern);
    } catch (error: any) {
      console.error('Error fetching pattern:', error);
      toast.error('Failed to load pattern');
      navigate('/patterns');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatternFiles = async () => {
    try {
      const response = await axios.get(`/api/uploads/patterns/${id}/files`);
      setFiles(response.data.data.files || []);
    } catch (error: any) {
      console.error('Error fetching pattern files:', error);
      // Don't show error toast for files - it's okay if there are no files yet
    }
  };

  const handleEditClick = () => {
    if (!pattern) return;
    setFormData({
      name: pattern.name || '',
      description: pattern.description || '',
      designer: pattern.designer || '',
      difficulty: pattern.difficulty || 'intermediate',
      category: pattern.category || 'sweater',
      yarnRequirements: pattern.yarn_requirements || '',
      needleSize: pattern.needle_size || '',
      gauge: pattern.gauge || '',
      sizesAvailable: pattern.sizes_available || '',
      notes: pattern.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdatePattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern) return;

    try {
      await axios.put(`/api/patterns/${pattern.id}`, formData);
      toast.success('Pattern updated successfully!');
      setShowEditModal(false);
      fetchPattern();
    } catch (error: any) {
      console.error('Error updating pattern:', error);
      toast.error(error.response?.data?.message || 'Failed to update pattern');
    }
  };

  const handleDeletePattern = async () => {
    if (!pattern) return;
    if (!confirm(`Are you sure you want to delete "${pattern.name}"? This will also delete all associated files.`)) {
      return;
    }

    try {
      await axios.delete(`/api/patterns/${pattern.id}`);
      toast.success('Pattern deleted successfully');
      navigate('/patterns');
    } catch (error: any) {
      console.error('Error deleting pattern:', error);
      toast.error('Failed to delete pattern');
    }
  };

  const handleFileUpload = async (file: File, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    try {
      await axios.post(`/api/uploads/patterns/${id}/files`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('File uploaded successfully!');
      fetchPatternFiles();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.message || 'Failed to upload file');
      throw error;
    }
  };

  const handleFileDownload = async (fileId: string, filename: string) => {
    try {
      const response = await axios.get(`/api/uploads/patterns/${id}/files/${fileId}/download`, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      await axios.delete(`/api/uploads/patterns/${id}/files/${fileId}`);
      toast.success('File deleted successfully');
      fetchPatternFiles();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
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
      case 'expert':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pattern...</div>
      </div>
    );
  }

  if (!pattern) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Pattern not found</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/patterns')}
          className="flex items-center text-purple-600 hover:text-purple-700 mb-4"
        >
          <FiArrowLeft className="mr-2" />
          Back to Patterns
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{pattern.name}</h1>
              {pattern.difficulty && (
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getDifficultyColor(pattern.difficulty)}`}>
                  {pattern.difficulty}
                </span>
              )}
            </div>
            {pattern.designer && (
              <p className="text-gray-600">by {pattern.designer}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleEditClick}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <FiEdit2 className="mr-2" />
              Edit
            </button>
            <button
              onClick={handleDeletePattern}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <FiTrash2 className="mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Pattern Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Main Info */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pattern Information</h2>

          {pattern.description && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
              <p className="text-gray-600">{pattern.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pattern.category && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">Category</h3>
                <p className="text-gray-900">{pattern.category}</p>
              </div>
            )}

            {pattern.needle_size && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">Needle Size</h3>
                <p className="text-gray-900">{pattern.needle_size}</p>
              </div>
            )}

            {pattern.gauge && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">Gauge</h3>
                <p className="text-gray-900">{pattern.gauge}</p>
              </div>
            )}

            {pattern.sizes_available && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">Sizes Available</h3>
                <p className="text-gray-900">{pattern.sizes_available}</p>
              </div>
            )}
          </div>

          {pattern.yarn_requirements && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Yarn Requirements</h3>
              <p className="text-gray-600">{pattern.yarn_requirements}</p>
            </div>
          )}

          {pattern.notes && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Notes</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{pattern.notes}</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Statistics</h2>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Times Used</h3>
              <p className="text-2xl font-bold text-purple-600">{pattern.times_used || 0}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700">Files Attached</h3>
              <p className="text-2xl font-bold text-purple-600">{files.length}</p>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">Created</h3>
              <p className="text-gray-600">{new Date(pattern.created_at).toLocaleDateString()}</p>
            </div>

            {pattern.updated_at && pattern.updated_at !== pattern.created_at && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">Last Updated</h3>
                <p className="text-gray-600">{new Date(pattern.updated_at).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pattern Files */}
      <PatternFileUpload
        files={files}
        onUpload={handleFileUpload}
        onDelete={handleFileDelete}
        onDownload={handleFileDownload}
      />

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Pattern</h2>
            </div>

            <form onSubmit={handleUpdatePattern} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pattern Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Designer</label>
                  <input
                    type="text"
                    value={formData.designer}
                    onChange={(e) => setFormData({ ...formData, designer: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Needle Size</label>
                  <input
                    type="text"
                    value={formData.needleSize}
                    onChange={(e) => setFormData({ ...formData, needleSize: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., US 7, 4.5mm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gauge</label>
                  <input
                    type="text"
                    value={formData.gauge}
                    onChange={(e) => setFormData({ ...formData, gauge: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 20 sts x 28 rows = 4 inches"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sizes Available</label>
                  <input
                    type="text"
                    value={formData.sizesAvailable}
                    onChange={(e) => setFormData({ ...formData, sizesAvailable: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., XS, S, M, L, XL"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Yarn Requirements</label>
                  <textarea
                    value={formData.yarnRequirements}
                    onChange={(e) => setFormData({ ...formData, yarnRequirements: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                    placeholder="e.g., 800 yards worsted weight yarn"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Additional notes, modifications, tips, etc."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
    </div>
  );
}
