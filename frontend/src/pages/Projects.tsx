import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiPlus, FiTrash2, FiCalendar, FiClock, FiMoreVertical, FiHeart, FiRefreshCw, FiX } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useEscapeKey } from '../hooks/useEscapeKey';
import ConfirmModal from '../components/ConfirmModal';
import ListControls, { applyListControls, type SortOption } from '../components/ListControls';
import { useProjects, useCreateProject, useDeleteProject, useUpdateProject } from '../hooks/useApi';

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

const PROJECT_SORT_OPTIONS: SortOption<any>[] = [
  {
    id: 'recent',
    label: 'Recently added',
    compare: (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
  },
  { id: 'name_asc', label: 'Name (A–Z)', compare: (a, b) => (a.name || '').localeCompare(b.name || '') },
  { id: 'status', label: 'Status', compare: (a, b) => (a.status || '').localeCompare(b.status || '') },
  {
    id: 'target_date',
    label: 'Target date (soonest)',
    compare: (a, b) => (a.target_completion_date || '9999').localeCompare(b.target_completion_date || '9999'),
  },
];

const STATUS_LABELS: Record<string, string> = {
  active: 'In progress',
  completed: 'Completed',
  paused: 'Paused',
  planned: 'Planned',
};

export default function Projects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || undefined;
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { data: projects = [], isLoading: loading } = useProjects({
    favorite: showFavoritesOnly,
    status: statusFilter,
  }) as { data: any[]; isLoading: boolean };

  const clearStatusFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    setSearchParams(next, { replace: true });
  };
  const [search, setSearch] = useState('');
  const [sortId, setSortId] = useState<string>('recent');
  const visibleProjects = useMemo(
    () =>
      applyListControls(projects, {
        search,
        searchFields: (p: any) => [p.name, p.description, p.project_type, p.status],
        sort: PROJECT_SORT_OPTIONS.find((s) => s.id === sortId),
      }),
    [projects, search, sortId],
  );
  const createProject = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMoreMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showMoreMenu]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeOption[]>(DEFAULT_PROJECT_TYPES);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    projectType: DEFAULT_PROJECT_TYPES[0].value,
    startDate: new Date().toISOString().split('T')[0],
    targetCompletionDate: '',
  });

  useEscapeKey(useCallback(() => setShowCreateModal(false), []), showCreateModal);

  useEffect(() => {
    fetchProjectTypes();
  }, []);

  useEffect(() => {
    if (!projectTypes.length) return;
    const currentTypeExists = projectTypes.some((type) => type.value === formData.projectType);
    if (!currentTypeExists) {
      setFormData((prev) => ({ ...prev, projectType: projectTypes[0].value }));
    }
  }, [projectTypes, formData.projectType]);

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
      setProjectTypes(DEFAULT_PROJECT_TYPES);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate(formData, {
      onSuccess: () => {
        toast.success('Project created successfully!');
        setShowCreateModal(false);
        setFormData({
          name: '',
          description: '',
          projectType: projectTypes[0]?.value || DEFAULT_PROJECT_TYPES[0].value,
          startDate: new Date().toISOString().split('T')[0],
          targetCompletionDate: '',
        });
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create project');
      },
    });
  };

  const handleDeleteProject = async (id: string) => {
    deleteProjectMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Project deleted successfully');
      },
      onError: () => {
        toast.error('Failed to delete project');
      },
      onSettled: () => {
        setDeleteTarget(null);
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'planned':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading projects...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Projects</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your knitting projects</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            New Project
          </button>
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu((s) => !s)}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={showMoreMenu}
            >
              <FiMoreVertical />
            </button>
            {showMoreMenu && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20"
              >
                <button
                  role="menuitem"
                  onClick={() => { setShowMoreMenu(false); navigate('/ravelry/projects/sync'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Sync projects from Ravelry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {statusFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800">
            Status: {STATUS_LABELS[statusFilter] || statusFilter}
            <button
              type="button"
              onClick={clearStatusFilter}
              className="hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-full p-0.5"
              aria-label="Clear status filter"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiClock className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {statusFilter ? `No ${(STATUS_LABELS[statusFilter] || statusFilter).toLowerCase()} projects` : 'No projects yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {statusFilter ? (
              <button type="button" onClick={clearStatusFilter} className="text-purple-600 hover:text-purple-700 dark:text-purple-400">
                Clear filter
              </button>
            ) : (
              'Start tracking your knitting projects'
            )}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Create Your First Project
          </button>
        </div>
      ) : (
        <>
        <ListControls
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search projects…"
          sortOptions={PROJECT_SORT_OPTIONS}
          sortValue={sortId}
          onSortChange={setSortId}
          showFavorites={showFavoritesOnly}
          onShowFavoritesChange={setShowFavoritesOnly}
          resultCount={visibleProjects.length}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleProjects.map((project: any) => (
            <div
              key={project.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition p-6 relative"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateProjectMutation.mutate({
                    id: project.id,
                    formData: { isFavorite: !project.is_favorite },
                  });
                }}
                className="absolute top-2 right-2 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur shadow hover:bg-white transition"
                aria-label={project.is_favorite ? 'Unfavorite project' : 'Favorite project'}
                title={project.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <FiHeart
                  className={`h-4 w-4 ${project.is_favorite ? 'text-red-500 fill-current' : 'text-gray-500'}`}
                />
              </button>
              <div className="flex items-start justify-between mb-3 pr-12">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1">
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
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="space-y-2 mb-4">
                {project.project_type && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Type:</span> {formatProjectTypeLabel(project.project_type)}
                  </div>
                )}
                {project.start_date && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <FiCalendar className="mr-2 h-4 w-4" />
                    Started: {formatDate(project.start_date)}
                  </div>
                )}
                {project.target_completion_date && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <FiClock className="mr-2 h-4 w-4" />
                    Due: {formatDate(project.target_completion_date)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  to={`/projects/${project.id}`}
                  className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition text-center text-sm font-medium"
                >
                  View Details
                </Link>
                <button
                  onClick={() => setDeleteTarget({ id: project.id, name: project.name })}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                  title="Delete project"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create New Project</h2>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Cozy Winter Sweater"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe your project..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Type
                </label>
                <select
                  value={formData.projectType}
                  onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                  disabled={loadingTypes}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Completion
                  </label>
                  <input
                    type="date"
                    value={formData.targetCompletionDate}
                    onChange={(e) =>
                      setFormData({ ...formData, targetCompletionDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Project"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteProject(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
