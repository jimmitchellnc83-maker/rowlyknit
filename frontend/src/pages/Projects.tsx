import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiTrash2, FiCalendar, FiClock } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Project {
  id: string;
  name: string;
  description: string;
  project_type: string;
  status: string;
  start_date: string;
  target_completion_date: string;
  completion_date: string;
  created_at: string;
}

interface ProjectTypeOption {
  value: string;
  label: string;
}

const DEFAULT_PROJECT_TYPES: ProjectTypeOption[] = [
  { value: 'sweater', label: 'Sweater/Pullover' },
  { value: 'cardigan', label: 'Cardigan' },
  { value: 'hat', label: 'Hat/Beanie' },
  { value: 'scarf', label: 'Scarf' },
  { value: 'cowl', label: 'Cowl/Neckwarmer' },
  { value: 'shawl', label: 'Shawl/Wrap' },
  { value: 'shawlette', label: 'Shawlette' },
  { value: 'socks', label: 'Socks' },
  { value: 'mittens', label: 'Mittens/Gloves' },
  { value: 'blanket', label: 'Blanket/Afghan' },
  { value: 'baby', label: 'Baby/Kids' },
  { value: 'toy', label: 'Toy/Amigurumi' },
  { value: 'bag', label: 'Bag/Tote' },
  { value: 'home', label: 'Home/Decor' },
  { value: 'dishcloth', label: 'Dishcloth/Washcloth' },
  { value: 'other', label: 'Other/Custom' },
];

const PROJECT_LABELS = DEFAULT_PROJECT_TYPES.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const formatProjectTypeLabel = (value: string) => {
  if (PROJECT_LABELS[value]) return PROJECT_LABELS[value];
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeOption[]>(DEFAULT_PROJECT_TYPES);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    projectType: DEFAULT_PROJECT_TYPES[0].value,
    startDate: new Date().toISOString().split('T')[0],
    targetCompletionDate: '',
  });

  useEffect(() => {
    fetchProjects();
    fetchProjectTypes();
  }, []);

  useEffect(() => {
    if (!projectTypes.length) return;
    const currentTypeExists = projectTypes.some((type) => type.value === formData.projectType);
    if (!currentTypeExists) {
      setFormData((prev) => ({ ...prev, projectType: projectTypes[0].value }));
    }
  }, [projectTypes, formData.projectType]);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      setProjects(response.data.data.projects);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTypes = async () => {
    try {
      setLoadingTypes(true);
      const response = await axios.get('/api/projects/types');
      const types: string[] =
        response.data?.data?.projectTypes || response.data?.projectTypes || [];

      if (types.length) {
        const options = types.map((value) => ({
          value,
          label: formatProjectTypeLabel(value),
        }));
        setProjectTypes(options);
      }
    } catch (error: any) {
      console.error('Error fetching project types:', error);
      toast.error('Using default project types (failed to load latest types)');
      setProjectTypes(DEFAULT_PROJECT_TYPES);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await axios.post('/api/projects', formData);
      toast.success('Project created successfully!');
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        projectType: projectTypes[0]?.value || DEFAULT_PROJECT_TYPES[0].value,
        startDate: new Date().toISOString().split('T')[0],
        targetCompletionDate: '',
      });
      fetchProjects();
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error(error.response?.data?.message || 'Failed to create project');
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/projects/${id}`);
      toast.success('Project deleted successfully');
      fetchProjects();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading projects...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your knitting projects</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <FiPlus className="mr-2" />
          New Project
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FiClock className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-500 mb-4">Start tracking your knitting projects</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 flex-1">
                  {project.name}
                </h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                    project.status
                  )}`}
                >
                  {project.status || 'active'}
                </span>
              </div>

              {project.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="space-y-2 mb-4">
                {project.project_type && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Type:</span> {project.project_type}
                  </div>
                )}
                {project.start_date && (
                  <div className="flex items-center text-sm text-gray-500">
                    <FiCalendar className="mr-2 h-4 w-4" />
                    Started: {formatDate(project.start_date)}
                  </div>
                )}
                {project.target_completion_date && (
                  <div className="flex items-center text-sm text-gray-500">
                    <FiClock className="mr-2 h-4 w-4" />
                    Due: {formatDate(project.target_completion_date)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <Link
                  to={`/projects/${project.id}`}
                  className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition text-center text-sm font-medium"
                >
                  View Details
                </Link>
                <button
                  onClick={() => handleDeleteProject(project.id, project.name)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                  title="Delete project"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Cozy Winter Sweater"
                  required
                />
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
                  placeholder="Describe your project..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Type
                </label>
                <select
                  value={formData.projectType}
                  onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                  disabled={loadingTypes}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {projectTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Completion
                  </label>
                  <input
                    type="date"
                    value={formData.targetCompletionDate}
                    onChange={(e) =>
                      setFormData({ ...formData, targetCompletionDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
