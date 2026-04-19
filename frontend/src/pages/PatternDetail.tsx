import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2, FiFileText, FiGrid, FiTool, FiBook } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { PDFCollation } from '../components/patterns';
import PatternFileUpload from '../components/PatternFileUpload';
import BookmarkManager from '../components/patterns/BookmarkManager';
import PatternViewer from '../components/patterns/PatternViewer';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmModal from '../components/ConfirmModal';
import { ChartImageUpload } from '../components/charts';

interface Pattern {
  id: string;
  name: string;
  description: string;
  designer: string;
  difficulty: string;
  category: string;
  yarn_requirements?: string;
  needle_sizes?: string;
  gauge?: string;
  sizes_available?: string;
  notes?: string;
  tags?: string[];
  is_favorite?: boolean;
  times_used?: number;
  thumbnail_url?: string | null;
  source_url?: string | null;
  estimated_yardage?: number | null;
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

interface PatternChart {
  id: string;
  name: string;
  project_id?: string | null;
  project_name?: string | null;
  rows?: number;
  columns?: number;
  updated_at?: string;
}

export default function PatternDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [files, setFiles] = useState<PatternFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState<PatternChart[]>([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [showAnnotationsModal, setShowAnnotationsModal] = useState(false);
  const [showCollationModal, setShowCollationModal] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [newSectionName, setNewSectionName] = useState('');
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'viewer' | 'charts' | 'tools'>('overview');
  const [selectedPdfFile, setSelectedPdfFile] = useState<PatternFile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    designer: '',
    difficulty: 'intermediate',
    category: 'sweater',
    yarnRequirements: '',
    needleSizes: '',
    gauge: '',
    sizesAvailable: '',
    notes: '',
  });

  useEffect(() => {
    if (id) {
      fetchPattern();
      fetchPatternFiles();
      fetchPatternCharts();
    }
  }, [id]);

  useEffect(() => {
    // Auto-select first PDF file for viewer
    if (files.length > 0 && !selectedPdfFile) {
      const pdfFile = files.find(f => f.file_type === 'pdf');
      if (pdfFile) {
        setSelectedPdfFile(pdfFile);
      }
    }
  }, [files, selectedPdfFile]);

  const fetchPattern = async () => {
    try {
      const response = await axios.get(`/api/patterns/${id}`);
      setPattern(response.data.data.pattern);
    } catch (error) {
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
    } catch {
      /* optional endpoint — failures are non-fatal */
    }
  };

  const fetchPatternCharts = async () => {
    if (!id) return;

    setChartsLoading(true);
    try {
      const response = await axios.get(`/api/patterns/${id}/charts`);
      setCharts(response.data.data.charts || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load charts for this pattern');
    } finally {
      setChartsLoading(false);
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
      needleSizes: pattern.needle_sizes || '',
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
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to update pattern');
    }
  };

  const [showDeletePatternConfirm, setShowDeletePatternConfirm] = useState(false);

  const handleDeletePattern = async () => {
    if (!pattern) return;
    try {
      await axios.delete(`/api/patterns/${pattern.id}`);
      toast.success('Pattern deleted successfully');
      navigate('/patterns');
    } catch {
      toast.error('Failed to delete pattern');
    } finally {
      setShowDeletePatternConfirm(false);
    }
  };

  const handleFileUpload = async (file: File, description?: string) => {
    const formDataObj = new FormData();
    formDataObj.append('file', file);
    if (description) {
      formDataObj.append('description', description);
    }

    try {
      await axios.post(`/api/uploads/patterns/${id}/files`, formDataObj, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('File uploaded successfully!');
      fetchPatternFiles();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to upload file');
      throw error;
    }
  };

  const handleFileDownload = async (fileId: string, filename: string) => {
    try {
      const response = await axios.get(`/api/uploads/patterns/${id}/files/${fileId}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      await axios.delete(`/api/uploads/patterns/${id}/files/${fileId}`);
      toast.success('File deleted successfully');
      fetchPatternFiles();
    } catch {
      toast.error('Failed to delete file');
    }
  };

  const handleChartCreated = (chart: PatternChart) => {
    setCharts((prev) => [chart, ...prev]);
    toast.success('Chart saved for this pattern');
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
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading pattern..." />
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
      <div className="mb-4 md:mb-6">
        <button
          onClick={() => navigate('/patterns')}
          className="flex items-center text-purple-600 hover:text-purple-700 mb-3 md:mb-4 min-h-[48px]"
        >
          <FiArrowLeft className="mr-2 h-5 w-5" />
          <span className="text-base md:text-sm">Back to Patterns</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{pattern.name}</h1>
              {pattern.difficulty && (
                <span className={`px-3 py-1 text-sm font-medium rounded-full self-start ${getDifficultyColor(pattern.difficulty)}`}>
                  {pattern.difficulty}
                </span>
              )}
            </div>
            {pattern.designer && (
              <p className="text-base md:text-sm text-gray-600">by {pattern.designer}</p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleEditClick}
              className="flex items-center justify-center px-4 py-3 md:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition min-h-[48px] md:min-h-0 flex-1 sm:flex-none"
            >
              <FiEdit2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
              <span className="text-base md:text-sm">Edit</span>
            </button>
            <button
              onClick={() => setShowDeletePatternConfirm(true)}
              className="flex items-center justify-center px-4 py-3 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition min-h-[48px] md:min-h-0 flex-1 sm:flex-none"
            >
              <FiTrash2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
              <span className="text-base md:text-sm">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="bg-white rounded-lg shadow mb-4 md:mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 md:px-6 py-4 md:py-3 text-sm md:text-base font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'overview'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiFileText className="h-5 w-5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Overview</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('viewer')}
              className={`px-4 md:px-6 py-4 md:py-3 text-sm md:text-base font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'viewer'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!selectedPdfFile ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!selectedPdfFile}
            >
              <div className="flex items-center gap-2">
                <FiFileText className="h-5 w-5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">PDF Viewer</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-4 md:px-6 py-4 md:py-3 text-sm md:text-base font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'charts'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiGrid className="h-5 w-5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Charts</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-4 md:px-6 py-4 md:py-3 text-sm md:text-base font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'tools'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiTool className="h-5 w-5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Tools</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Pattern Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left column: Photo + Stats */}
        <div className="lg:col-span-1 space-y-6">
          {pattern.thumbnail_url ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="w-full aspect-square bg-gray-100">
                <img
                  src={pattern.thumbnail_url}
                  alt={pattern.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                <FiBook className="h-24 w-24 text-gray-300" />
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Statistics</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Times Used</div>
                <div className="text-2xl font-bold text-purple-600">{pattern.times_used || 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Files Attached</div>
                <div className="text-2xl font-bold text-purple-600">{files.length}</div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Created</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">{new Date(pattern.created_at).toLocaleDateString()}</div>
              </div>
              {pattern.updated_at && pattern.updated_at !== pattern.created_at && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Last Updated</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">{new Date(pattern.updated_at).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Pattern info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title card with category */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">About</h2>
            {pattern.category && (
              <p className="text-sm text-gray-500 mb-3">
                <span className="capitalize">{pattern.category}</span>
              </p>
            )}
            {pattern.description ? (
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {pattern.description}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No description yet.</p>
            )}
          </div>

          {/* Specifications */}
          {(pattern.needle_sizes || pattern.gauge || pattern.sizes_available) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Specifications</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pattern.needle_sizes && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase tracking-wide">Needle Sizes</dt>
                    <dd className="text-gray-900 dark:text-gray-100 mt-1">{pattern.needle_sizes}</dd>
                  </div>
                )}
                {pattern.gauge && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase tracking-wide">Gauge</dt>
                    <dd className="text-gray-900 dark:text-gray-100 mt-1">{pattern.gauge}</dd>
                  </div>
                )}
                {pattern.sizes_available && (
                  <div className="md:col-span-2">
                    <dt className="text-xs text-gray-500 uppercase tracking-wide">Sizes Available</dt>
                    <dd className="text-gray-900 dark:text-gray-100 mt-1">{pattern.sizes_available}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Yarn Requirements */}
          {pattern.yarn_requirements && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Yarn Requirements</h2>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{pattern.yarn_requirements}</div>
            </div>
          )}

          {/* Notes */}
          {pattern.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Notes</h2>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{pattern.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Pattern Files */}
      <PatternFileUpload
        files={files}
        onUpload={handleFileUpload}
        onDelete={handleFileDelete}
        onDownload={handleFileDownload}
        patternId={id}
      />

          {/* Bookmarks */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <BookmarkManager
              patternId={id!}
              onJumpToBookmark={(bookmark) => {
                toast.info(`Jumping to page ${bookmark.page_number}`);
                setActiveTab('viewer');
              }}
            />
          </div>
        </>
      )}

      {/* PDF Viewer Tab */}
      {activeTab === 'viewer' && selectedPdfFile && (
        <div className="bg-white rounded-lg shadow overflow-hidden" style={{ height: '800px' }}>
          <PatternViewer
            fileUrl={`/api/uploads/patterns/${id}/files/${selectedPdfFile.id}/download`}
            filename={selectedPdfFile.original_filename}
            patternId={id}
            fullscreen={false}
          />
        </div>
      )}

      {/* Charts Tab */}
      {activeTab === 'charts' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="border border-gray-200 rounded-lg">
              <ChartImageUpload
                patternId={id}
                onChartCreated={handleChartCreated}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Charts linked to this pattern</h3>
                  <p className="text-sm text-gray-500">Imports and saved charts will appear here.</p>
                </div>
                <FiGrid className="text-gray-400" />
              </div>

              {chartsLoading ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner />
                </div>
              ) : charts.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500">
                  No charts have been linked to this pattern yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {charts.map((chart) => (
                    <div
                      key={chart.id}
                      className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{chart.name || 'Untitled chart'}</p>
                        <p className="text-sm text-gray-500">
                          {chart.rows || 0} rows · {chart.columns || 0} columns
                          {chart.project_name && (
                            <span className="ml-2 text-gray-400">
                              · Project:{' '}
                              {chart.project_id ? (
                                <Link
                                  to={`/projects/${chart.project_id}`}
                                  className="text-purple-600 hover:text-purple-700 hover:underline"
                                >
                                  {chart.project_name}
                                </Link>
                              ) : (
                                chart.project_name
                              )}
                            </span>
                          )}
                        </p>
                        {chart.updated_at && (
                          <p className="text-xs text-gray-400 mt-1">
                            Updated {new Date(chart.updated_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {activeTab === 'tools' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pattern Tools</h2>
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Pattern Sections</h3>
              <p className="text-sm text-gray-600 mb-3">
                Organize your pattern into sections for easier navigation
              </p>
              <button
                onClick={async () => {
                  try {
                    const res = await axios.get(`/api/patterns/${id}/sections`);
                    setSections(res.data.data.sections || []);
                    setShowSectionsModal(true);
                  } catch { toast.error('Failed to load sections'); }
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Manage Sections
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Pattern Annotations</h3>
              <p className="text-sm text-gray-600 mb-3">
                Add notes and annotations directly to your pattern
              </p>
              <button
                onClick={async () => {
                  try {
                    const res = await axios.get(`/api/patterns/${id}/annotations`);
                    setAnnotations(res.data.data.annotations || []);
                    setShowAnnotationsModal(true);
                  } catch { toast.error('Failed to load annotations'); }
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add Annotations
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Pattern Collation</h3>
              <p className="text-sm text-gray-600 mb-3">
                Combine multiple PDFs into a single pattern document
              </p>
              <button
                onClick={() => setShowCollationModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Collate PDFs
              </button>
            </div>
          </div>
        </div>
      )}

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
                    value={formData.needleSizes}
                    onChange={(e) => setFormData({ ...formData, needleSizes: e.target.value })}
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
      {/* Sections Modal */}
      {showSectionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">Pattern Sections</h2>
              <button onClick={() => setShowSectionsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="Section name (e.g., Body, Sleeves)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={async () => {
                    if (!newSectionName.trim()) return;
                    try {
                      await axios.post(`/api/patterns/${id}/sections`, { name: newSectionName, sortOrder: sections.length });
                      const res = await axios.get(`/api/patterns/${id}/sections`);
                      setSections(res.data.data.sections || []);
                      setNewSectionName('');
                      toast.success('Section added');
                    } catch { toast.error('Failed to add section'); }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >Add</button>
              </div>
              {sections.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No sections yet</p>
              ) : (
                <ul className="space-y-2">
                  {sections.map((s: any) => (
                    <li key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{s.name}</span>
                      <button
                        onClick={async () => {
                          try {
                            await axios.delete(`/api/patterns/${id}/sections/${s.id}`);
                            setSections(sections.filter((x: any) => x.id !== s.id));
                            toast.success('Section deleted');
                          } catch { toast.error('Failed to delete'); }
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >Delete</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Annotations Modal */}
      {showAnnotationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">Pattern Annotations</h2>
              <button onClick={() => setShowAnnotationsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6">
              <div className="flex gap-2 mb-4">
                <textarea
                  value={newAnnotationText}
                  onChange={(e) => setNewAnnotationText(e.target.value)}
                  placeholder="Add a note about this pattern..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={2}
                />
                <button
                  onClick={async () => {
                    if (!newAnnotationText.trim()) return;
                    try {
                      await axios.post(`/api/patterns/${id}/annotations`, { data: { content: newAnnotationText }, annotationType: 'note' });
                      const res = await axios.get(`/api/patterns/${id}/annotations`);
                      setAnnotations(res.data.data.annotations || []);
                      setNewAnnotationText('');
                      toast.success('Annotation added');
                    } catch { toast.error('Failed to add annotation'); }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 self-end"
                >Add</button>
              </div>
              {annotations.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No annotations yet</p>
              ) : (
                <ul className="space-y-2">
                  {annotations.map((a: any) => (
                    <li key={a.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 flex-1">{a.data?.content || a.content || JSON.stringify(a.data)}</p>
                      <button
                        onClick={async () => {
                          try {
                            await axios.delete(`/api/patterns/${id}/annotations/${a.id}`);
                            setAnnotations(annotations.filter((x: any) => x.id !== a.id));
                            toast.success('Annotation deleted');
                          } catch { toast.error('Failed to delete'); }
                        }}
                        className="text-red-500 hover:text-red-700 text-sm ml-2"
                      >Delete</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collation Modal */}
      {showCollationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">Collate Pattern PDFs</h2>
              <button onClick={() => setShowCollationModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6">
              <PDFCollation />
            </div>
          </div>
        </div>
      )}

      {showDeletePatternConfirm && pattern && (
        <ConfirmModal
          title="Delete pattern?"
          message={`Delete "${pattern.name}"? This will also delete all associated files and cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeletePattern}
          onCancel={() => setShowDeletePatternConfirm(false)}
        />
      )}
    </div>
  );
}
