// @ts-nocheck
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2, FiFileText, FiGrid, FiTool } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import PatternFileUpload from '../components/PatternFileUpload';
import BookmarkManager from '../components/patterns/BookmarkManager';
import PatternViewer from '../components/patterns/PatternViewer';
import { ChartViewer } from '../components/patterns/ChartViewer';
import { ChartEditor } from '../components/patterns/ChartEditor';
import { ChartUpload } from '../components/patterns/ChartUpload';
import LoadingSpinner from '../components/LoadingSpinner';
import PatternSectionsManager from '../components/patterns/PatternSectionsManager';
import PatternAnnotationsManager from '../components/patterns/PatternAnnotationsManager';
import PDFCollation from '../components/patterns/PDFCollation';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'viewer' | 'charts' | 'tools'>('overview');
  const [selectedPdfFile, setSelectedPdfFile] = useState<PatternFile | null>(null);
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
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [showAnnotationsModal, setShowAnnotationsModal] = useState(false);
  const [showCollationModal, setShowCollationModal] = useState(false);
  const [charts, setCharts] = useState<any[]>([]);
  const [selectedChart, setSelectedChart] = useState<any | null>(null);
  const [showChartEditor, setShowChartEditor] = useState(false);
  const [showChartUpload, setShowChartUpload] = useState(false);
  const [showChartViewer, setShowChartViewer] = useState(false);
  const [editingChart, setEditingChart] = useState<any | null>(null);

  useEffect(() => {
    if (id) {
      fetchPattern();
      fetchPatternFiles();
      fetchCharts();
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

  const fetchCharts = async () => {
    try {
      const response = await axios.get(`/api/patterns/${id}/charts`);
      setCharts(response.data.data.charts || []);
    } catch (error: any) {
      console.error('Error fetching charts:', error);
      // Don't show error toast - it's okay if there are no charts yet
    }
  };

  const fetchChartDetail = async (chartId: string) => {
    try {
      const response = await axios.get(`/api/patterns/${id}/charts/${chartId}`);
      return response.data.data.chart;
    } catch (error: any) {
      console.error('Error fetching chart:', error);
      toast.error('Failed to load chart');
      return null;
    }
  };

  const handleChartSaved = () => {
    setShowChartEditor(false);
    setShowChartUpload(false);
    setEditingChart(null);
    fetchCharts();
  };

  const handleChartEdit = async (chart: any) => {
    const chartDetail = await fetchChartDetail(chart.id);
    if (chartDetail) {
      setEditingChart(chartDetail);
      setShowChartEditor(true);
    }
  };

  const handleChartView = async (chart: any) => {
    const chartDetail = await fetchChartDetail(chart.id);
    if (chartDetail) {
      setSelectedChart(chartDetail);
      setShowChartViewer(true);
    }
  };

  const handleChartDelete = async (chartId: string, chartTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${chartTitle}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/patterns/${id}/charts/${chartId}`);
      toast.success('Chart deleted successfully');
      fetchCharts();
    } catch (error: any) {
      console.error('Error deleting chart:', error);
      toast.error('Failed to delete chart');
    }
  };

  const handleChartUpload = (chartData: any) => {
    setEditingChart(chartData);
    setShowChartUpload(false);
    setShowChartEditor(true);
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
              onClick={handleDeletePattern}
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
        patternId={id}
      />

          {/* Bookmarks */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <BookmarkManager
              patternId={id!}
              onJumpToBookmark={(bookmark) => {
                toast.info(`Jumping to page ${bookmark.page_number}`);
                setActiveTab('viewer');
                // TODO: Jump to specific page in viewer
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
      {activeTab === 'charts' && !showChartEditor && !showChartUpload && !showChartViewer && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Pattern Charts</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowChartUpload(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <FiGrid />
                Import Chart
              </button>
              <button
                onClick={() => {
                  setEditingChart(null);
                  setShowChartEditor(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <FiGrid />
                Create Chart
              </button>
            </div>
          </div>

          {charts.length === 0 ? (
            <div className="text-center py-12">
              <FiGrid className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Charts Yet</h3>
              <p className="text-gray-500 mb-4">
                Create or import knitting charts to visualize your pattern
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowChartUpload(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Import Chart
                </button>
                <button
                  onClick={() => {
                    setEditingChart(null);
                    setShowChartEditor(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create New Chart
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {charts.map((chart) => (
                <div
                  key={chart.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900">{chart.title}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleChartEdit(chart)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Chart"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleChartDelete(chart.id, chart.title)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete Chart"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1 mb-3">
                    <div>Size: {chart.rows} × {chart.cols}</div>
                    <div>Type: {chart.is_in_the_round ? 'In the Round' : 'Flat'}</div>
                    {chart.notes && (
                      <div className="text-xs text-gray-500 line-clamp-2">{chart.notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleChartView(chart)}
                    className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium"
                  >
                    View Chart
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chart Editor Modal */}
      {activeTab === 'charts' && showChartEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
            <ChartEditor
              patternId={id!}
              chartData={editingChart}
              onSave={handleChartSaved}
              onCancel={() => {
                setShowChartEditor(false);
                setEditingChart(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Chart Upload Modal */}
      {activeTab === 'charts' && showChartUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <ChartUpload
            onUpload={handleChartUpload}
            onCancel={() => setShowChartUpload(false)}
          />
        </div>
      )}

      {/* Chart Viewer Modal */}
      {activeTab === 'charts' && showChartViewer && selectedChart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">{selectedChart.title}</h2>
              <button
                onClick={() => {
                  setShowChartViewer(false);
                  setSelectedChart(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>
            <ChartViewer
              chartData={selectedChart.chartData}
              symbols={selectedChart.symbols}
              rows={selectedChart.rows}
              cols={selectedChart.cols}
              title={selectedChart.title}
              isInTheRound={selectedChart.is_in_the_round}
            />
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
                onClick={() => setShowSectionsModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
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
                onClick={() => setShowAnnotationsModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
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
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Collate PDFs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pattern Sections Modal */}
      {showSectionsModal && pattern && (
        <PatternSectionsManager
          patternId={pattern.id}
          onClose={() => setShowSectionsModal(false)}
        />
      )}

      {/* Pattern Annotations Modal */}
      {showAnnotationsModal && pattern && (
        <PatternAnnotationsManager
          patternId={pattern.id}
          onClose={() => setShowAnnotationsModal(false)}
        />
      )}

      {/* Pattern Collation Modal */}
      {showCollationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Collate Pattern PDFs</h2>
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
