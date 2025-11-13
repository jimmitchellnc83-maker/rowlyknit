import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowLeft, FiEdit2, FiTrash2, FiCalendar, FiClock, FiCheck, FiImage,
  FiPlus, FiX, FiPackage, FiTool, FiUser, FiAlertCircle
} from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import PhotoGallery from '../components/PhotoGallery';
import FileUpload from '../components/FileUpload';
import CounterManager from '../components/counters/CounterManager';
import { SessionManager } from '../components/sessions';
import { useWebSocket } from '../contexts/WebSocketContext';

interface Project {
  id: string;
  name: string;
  description: string;
  project_type: string;
  status: string;
  start_date: string;
  target_completion_date: string;
  completion_date: string;
  notes: string;
  recipient_id?: string;
  photos: any[];
  counters: any[];
  patterns: any[];
  yarn: any[];
  tools: any[];
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { joinProject, leaveProject } = useWebSocket();

  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  // Modal states for adding items
  const [showAddPatternModal, setShowAddPatternModal] = useState(false);
  const [showAddYarnModal, setShowAddYarnModal] = useState(false);
  const [showAddToolModal, setShowAddToolModal] = useState(false);

  // Available items to add
  const [availablePatterns, setAvailablePatterns] = useState<any[]>([]);
  const [availableYarn, setAvailableYarn] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [availableRecipients, setAvailableRecipients] = useState<any[]>([]);

  // Selected items for adding
  const [selectedPatternId, setSelectedPatternId] = useState('');
  const [selectedYarnId, setSelectedYarnId] = useState('');
  const [yarnQuantity, setYarnQuantity] = useState({ skeins: '', yards: '' });
  const [selectedToolId, setSelectedToolId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    notes: '',
    recipientId: '',
  });

  useEffect(() => {
    fetchProject();
    fetchPhotos();
    fetchAvailableItems();

    if (id) {
      joinProject(id);
    }

    return () => {
      if (id) {
        leaveProject(id);
      }
    };
  }, [id, joinProject, leaveProject]);

  const fetchProject = async () => {
    try {
      const response = await axios.get(`/api/projects/${id}`);
      const projectData = response.data.data.project;
      setProject(projectData);
      setFormData({
        name: projectData.name,
        description: projectData.description || '',
        status: projectData.status || 'active',
        notes: projectData.notes || '',
        recipientId: projectData.recipient_id || '',
      });
    } catch (error: any) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const [patternsRes, yarnRes, toolsRes, recipientsRes] = await Promise.all([
        axios.get('/api/patterns'),
        axios.get('/api/yarn'),
        axios.get('/api/tools'),
        axios.get('/api/recipients'),
      ]);
      setAvailablePatterns(patternsRes.data.data.patterns || []);
      setAvailableYarn(yarnRes.data.data.yarn || []);
      setAvailableTools(toolsRes.data.data.tools || []);
      setAvailableRecipients(recipientsRes.data.data.recipients || []);
    } catch (error) {
      console.error('Error fetching available items:', error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await axios.put(`/api/projects/${id}`, formData);
      toast.success('Project updated successfully!');
      setShowEditModal(false);
      fetchProject();
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${project?.name}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/projects/${id}`);
      toast.success('Project deleted successfully');
      navigate('/projects');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  // Pattern management
  const handleAddPattern = async () => {
    if (!selectedPatternId) {
      toast.error('Please select a pattern');
      return;
    }

    try {
      await axios.post(`/api/projects/${id}/patterns`, {
        patternId: selectedPatternId,
      });
      toast.success('Pattern added to project!');
      setShowAddPatternModal(false);
      setSelectedPatternId('');
      fetchProject();
    } catch (error: any) {
      console.error('Error adding pattern:', error);
      toast.error(error.response?.data?.message || 'Failed to add pattern');
    }
  };

  const handleRemovePattern = async (patternId: string) => {
    try {
      await axios.delete(`/api/projects/${id}/patterns/${patternId}`);
      toast.success('Pattern removed from project');
      fetchProject();
    } catch (error: any) {
      console.error('Error removing pattern:', error);
      toast.error('Failed to remove pattern');
    }
  };

  // Yarn management
  const handleAddYarn = async () => {
    if (!selectedYarnId) {
      toast.error('Please select yarn');
      return;
    }

    try {
      await axios.post(`/api/projects/${id}/yarn`, {
        yarnId: selectedYarnId,
        skeinsUsed: yarnQuantity.skeins ? parseFloat(yarnQuantity.skeins) : undefined,
        yardsUsed: yarnQuantity.yards ? parseFloat(yarnQuantity.yards) : undefined,
      });
      toast.success('Yarn added to project! Stash has been updated.');
      setShowAddYarnModal(false);
      setSelectedYarnId('');
      setYarnQuantity({ skeins: '', yards: '' });
      fetchProject();
      fetchAvailableItems(); // Refresh to show updated yarn quantities
    } catch (error: any) {
      console.error('Error adding yarn:', error);
      toast.error(error.response?.data?.message || 'Failed to add yarn');
    }
  };

  const handleRemoveYarn = async (yarnId: string) => {
    if (!confirm('Remove this yarn? The used amount will be restored to your stash.')) {
      return;
    }

    try {
      await axios.delete(`/api/projects/${id}/yarn/${yarnId}`);
      toast.success('Yarn removed and restored to stash');
      fetchProject();
      fetchAvailableItems(); // Refresh to show updated yarn quantities
    } catch (error: any) {
      console.error('Error removing yarn:', error);
      toast.error('Failed to remove yarn');
    }
  };

  // Tool management
  const handleAddTool = async () => {
    if (!selectedToolId) {
      toast.error('Please select a tool');
      return;
    }

    try {
      await axios.post(`/api/projects/${id}/tools`, {
        toolId: selectedToolId,
      });
      toast.success('Tool added to project!');
      setShowAddToolModal(false);
      setSelectedToolId('');
      fetchProject();
    } catch (error: any) {
      console.error('Error adding tool:', error);
      toast.error(error.response?.data?.message || 'Failed to add tool');
    }
  };

  const handleRemoveTool = async (toolId: string) => {
    try {
      await axios.delete(`/api/projects/${id}/tools/${toolId}`);
      toast.success('Tool removed from project');
      fetchProject();
    } catch (error: any) {
      console.error('Error removing tool:', error);
      toast.error('Failed to remove tool');
    }
  };

  const fetchPhotos = async () => {
    try {
      const response = await axios.get(`/api/uploads/projects/${id}/photos`);
      setPhotos(response.data.data.photos);
    } catch (error: any) {
      console.error('Error fetching photos:', error);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);

    try {
      await axios.post(`/api/uploads/projects/${id}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Photo uploaded successfully!');
      fetchPhotos();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
      throw error;
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    try {
      await axios.delete(`/api/uploads/projects/${id}/photos/${photoId}`);
      toast.success('Photo deleted successfully');
      fetchPhotos();
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'planned':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getYarnPercentage = (y: any) => {
    const remaining = y.yarn_remaining || 0;
    const total = y.yarn_total || 1;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Project not found</p>
        <Link to="/projects" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
          Back to Projects
        </Link>
      </div>
    );
  }

  const selectedRecipient = availableRecipients.find(r => r.id === formData.recipientId);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
        >
          <FiArrowLeft className="mr-2" />
          Back to Projects
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
                  project.status
                )}`}
              >
                {project.status}
              </span>
            </div>
            {project.project_type && (
              <p className="text-gray-600">Type: {project.project_type}</p>
            )}
            {selectedRecipient && (
              <p className="text-gray-600 flex items-center mt-1">
                <FiUser className="mr-2 h-4 w-4" />
                Gift for: {selectedRecipient.first_name} {selectedRecipient.last_name}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center"
            >
              <FiEdit2 className="mr-2" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center"
            >
              <FiTrash2 className="mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Project Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {project.description && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{project.description}</p>
            </div>
          )}

          {/* Yarn Usage Tracker */}
          {project.yarn && project.yarn.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Yarn Usage</h2>
                <button
                  onClick={() => setShowAddYarnModal(true)}
                  className="flex items-center px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                >
                  <FiPlus className="mr-1 h-4 w-4" />
                  Add Yarn
                </button>
              </div>

              <div className="space-y-4">
                {project.yarn.map((y: any) => {
                  const percentage = getYarnPercentage(y);
                  const isLowStock = y.low_stock_alert && y.yards_remaining <= (y.low_stock_threshold || 0);

                  return (
                    <div key={y.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {y.brand} {y.name}
                            {y.color && <span className="text-gray-600"> - {y.color}</span>}
                          </h3>
                          <p className="text-sm text-gray-500">{y.weight}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveYarn(y.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove yarn"
                        >
                          <FiX className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Usage Stats */}
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Used in Project</p>
                          <p className="text-sm font-medium text-gray-900">
                            {y.skeins_used || 0} skeins, {y.yards_used || 0} yds
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Remaining in Stash</p>
                          <p className="text-sm font-medium text-gray-900">
                            {y.skeins_remaining || 0} skeins, {y.yards_remaining || 0} yds
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Stash Level</span>
                          <span>{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              percentage < 20 ? 'bg-red-500' : percentage < 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Low Stock Warning */}
                      {isLowStock && (
                        <div className="flex items-center text-orange-600 text-sm mt-2">
                          <FiAlertCircle className="mr-2 h-4 w-4" />
                          Low stock! Only {y.yards_remaining} yards remaining
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Yarn Button if none */}
          {(!project.yarn || project.yarn.length === 0) && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center py-8">
                <FiPackage className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Yarn Added</h3>
                <p className="text-gray-500 mb-4">Add yarn to track usage and stash levels</p>
                <button
                  onClick={() => setShowAddYarnModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <FiPlus className="mr-2" />
                  Add Yarn
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {project.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}

          {/* Photos */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <FiImage className="h-5 w-5 text-purple-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Project Photos</h2>
              <span className="ml-2 text-sm text-gray-500">({photos.length})</span>
            </div>

            <div className="mb-6">
              <FileUpload onUpload={handlePhotoUpload} />
            </div>

            <PhotoGallery photos={photos} onDelete={handlePhotoDelete} />
          </div>

          {/* Counters */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Counters</h2>
            <CounterManager projectId={id!} />
          </div>

          {/* Session Management */}
          <SessionManager
            projectId={id!}
            totalRows={0} // TODO: Get from project or pattern
            getCurrentCounterValues={() => {
              // Get counter values from CounterManager
              // This is a placeholder - you may need to lift state up or use context
              return {};
            }}
          />
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-3">
              {project.start_date && (
                <div className="flex items-start">
                  <FiCalendar className="mt-1 mr-3 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Started</p>
                    <p className="text-sm text-gray-600">{formatDate(project.start_date)}</p>
                  </div>
                </div>
              )}
              {project.target_completion_date && (
                <div className="flex items-start">
                  <FiClock className="mt-1 mr-3 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Target Completion</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(project.target_completion_date)}
                    </p>
                  </div>
                </div>
              )}
              {project.completion_date && (
                <div className="flex items-start">
                  <FiCheck className="mt-1 mr-3 h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Completed</p>
                    <p className="text-sm text-gray-600">{formatDate(project.completion_date)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Patterns */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Patterns</h2>
              <button
                onClick={() => setShowAddPatternModal(true)}
                className="text-purple-600 hover:text-purple-700"
                title="Add pattern"
              >
                <FiPlus className="h-5 w-5" />
              </button>
            </div>

            {project.patterns && project.patterns.length > 0 ? (
              <ul className="space-y-2">
                {project.patterns.map((pattern: any) => (
                  <li key={pattern.id} className="flex items-center justify-between text-sm">
                    <Link
                      to={`/patterns/${pattern.id}`}
                      className="text-purple-600 hover:text-purple-700 flex-1"
                    >
                      {pattern.name}
                    </Link>
                    <button
                      onClick={() => handleRemovePattern(pattern.id)}
                      className="text-red-600 hover:text-red-700 ml-2"
                      title="Remove pattern"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No patterns added</p>
            )}
          </div>

          {/* Tools */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Tools</h2>
              <button
                onClick={() => setShowAddToolModal(true)}
                className="text-purple-600 hover:text-purple-700"
                title="Add tool"
              >
                <FiPlus className="h-5 w-5" />
              </button>
            </div>

            {project.tools && project.tools.length > 0 ? (
              <ul className="space-y-2">
                {project.tools.map((tool: any) => (
                  <li key={tool.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 flex-1">
                      {tool.name}
                      {tool.size && <span className="text-gray-500"> ({tool.size})</span>}
                    </span>
                    <button
                      onClick={() => handleRemoveTool(tool.id)}
                      className="text-red-600 hover:text-red-700 ml-2"
                      title="Remove tool"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No tools added</p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Project</h2>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gift Recipient (Optional)
                  </label>
                  <select
                    value={formData.recipientId}
                    onChange={(e) => setFormData({ ...formData, recipientId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {availableRecipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.first_name} {r.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={5}
                  placeholder="Add notes about your project..."
                />
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Pattern Modal */}
      {showAddPatternModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add Pattern to Project</h2>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Pattern
              </label>
              <select
                value={selectedPatternId}
                onChange={(e) => setSelectedPatternId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
              >
                <option value="">Choose a pattern...</option>
                {availablePatterns
                  .filter(p => !project?.patterns?.some((pp: any) => pp.id === p.id))
                  .map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.name}
                      {pattern.designer && ` by ${pattern.designer}`}
                    </option>
                  ))}
              </select>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddPatternModal(false);
                    setSelectedPatternId('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPattern}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Add Pattern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Yarn Modal */}
      {showAddYarnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add Yarn to Project</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Yarn
                </label>
                <select
                  value={selectedYarnId}
                  onChange={(e) => setSelectedYarnId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Choose yarn...</option>
                  {availableYarn
                    .filter(y => y.skeins_remaining > 0)
                    .map((yarn) => (
                      <option key={yarn.id} value={yarn.id}>
                        {yarn.brand} {yarn.name} - {yarn.color}
                        ({yarn.skeins_remaining} skeins, {yarn.yards_remaining} yds available)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skeins to Use
                  </label>
                  <input
                    type="number"
                    value={yarnQuantity.skeins}
                    onChange={(e) => setYarnQuantity({ ...yarnQuantity, skeins: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yards to Use
                  </label>
                  <input
                    type="number"
                    value={yarnQuantity.yards}
                    onChange={(e) => setYarnQuantity({ ...yarnQuantity, yards: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              <p className="text-sm text-gray-500">
                The specified amount will be deducted from your stash automatically.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddYarnModal(false);
                    setSelectedYarnId('');
                    setYarnQuantity({ skeins: '', yards: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddYarn}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Add Yarn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Tool Modal */}
      {showAddToolModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add Tool to Project</h2>
            </div>

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
                  .filter(t => !project?.tools?.some((pt: any) => pt.id === t.id))
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
                  onClick={() => {
                    setShowAddToolModal(false);
                    setSelectedToolId('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTool}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Add Tool
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
