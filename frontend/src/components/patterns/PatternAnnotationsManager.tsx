import { useState, useEffect } from 'react';
import { FiBookmark, FiEdit3, FiHighlight, FiPlus, FiTrash2 } from 'react-icons/fi';
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

interface Highlight {
  id: string;
  pattern_id: string;
  project_id: string | null;
  page_number: number;
  coordinates: { x: number; y: number; width: number; height: number };
  color: string;
  opacity: number;
  layer: number;
  created_at: string;
}

interface Annotation {
  id: string;
  pattern_id: string;
  project_id: string | null;
  page_number: number;
  annotation_type: string;
  data: any;
  image_url: string | null;
  created_at: string;
}

interface PatternAnnotationsManagerProps {
  patternId: string;
  projectId?: string;
  onClose: () => void;
}

type TabType = 'bookmarks' | 'highlights' | 'annotations';

export default function PatternAnnotationsManager({
  patternId,
  projectId,
  onClose,
}: PatternAnnotationsManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('bookmarks');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookmarkForm, setShowBookmarkForm] = useState(false);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [bookmarkForm, setBookmarkForm] = useState({
    name: '',
    pageNumber: '',
    notes: '',
    color: '#FBBF24',
  });
  const [annotationForm, setAnnotationForm] = useState({
    pageNumber: '',
    annotationType: 'text',
    text: '',
  });

  useEffect(() => {
    fetchData();
  }, [patternId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'bookmarks') {
        const response = await axios.get(
          `/api/patterns/${patternId}/bookmarks${projectId ? `?projectId=${projectId}` : ''}`
        );
        setBookmarks(response.data.data.bookmarks || []);
      } else if (activeTab === 'highlights') {
        const response = await axios.get(
          `/api/patterns/${patternId}/highlights${projectId ? `?projectId=${projectId}` : ''}`
        );
        setHighlights(response.data.data.highlights || []);
      } else if (activeTab === 'annotations') {
        const response = await axios.get(
          `/api/patterns/${patternId}/annotations${projectId ? `?projectId=${projectId}` : ''}`
        );
        setAnnotations(response.data.data.annotations || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBookmark = async () => {
    if (!bookmarkForm.name.trim()) {
      toast.error('Bookmark name is required');
      return;
    }

    if (!bookmarkForm.pageNumber) {
      toast.error('Page number is required');
      return;
    }

    try {
      await axios.post(`/api/patterns/${patternId}/bookmarks`, {
        name: bookmarkForm.name,
        pageNumber: parseInt(bookmarkForm.pageNumber),
        notes: bookmarkForm.notes || null,
        color: bookmarkForm.color,
        projectId: projectId || null,
      });

      toast.success('Bookmark created!');
      setShowBookmarkForm(false);
      setBookmarkForm({ name: '', pageNumber: '', notes: '', color: '#FBBF24' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating bookmark:', error);
      toast.error(error.response?.data?.message || 'Failed to create bookmark');
    }
  };

  const handleCreateAnnotation = async () => {
    if (!annotationForm.pageNumber) {
      toast.error('Page number is required');
      return;
    }

    if (!annotationForm.text.trim()) {
      toast.error('Annotation text is required');
      return;
    }

    try {
      await axios.post(`/api/patterns/${patternId}/annotations`, {
        pageNumber: parseInt(annotationForm.pageNumber),
        annotationType: annotationForm.annotationType,
        data: { text: annotationForm.text },
        projectId: projectId || null,
      });

      toast.success('Annotation created!');
      setShowAnnotationForm(false);
      setAnnotationForm({ pageNumber: '', annotationType: 'text', text: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating annotation:', error);
      toast.error(error.response?.data?.message || 'Failed to create annotation');
    }
  };

  const handleDeleteBookmark = async (bookmarkId: string, name: string) => {
    if (!confirm(`Delete bookmark "${name}"?`)) return;

    try {
      await axios.delete(`/api/patterns/${patternId}/bookmarks/${bookmarkId}`);
      toast.success('Bookmark deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast.error('Failed to delete bookmark');
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    if (!confirm('Delete this highlight?')) return;

    try {
      await axios.delete(`/api/patterns/${patternId}/highlights/${highlightId}`);
      toast.success('Highlight deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting highlight:', error);
      toast.error('Failed to delete highlight');
    }
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    if (!confirm('Delete this annotation?')) return;

    try {
      await axios.delete(`/api/patterns/${patternId}/annotations/${annotationId}`);
      toast.success('Annotation deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting annotation:', error);
      toast.error('Failed to delete annotation');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Pattern Annotations</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'bookmarks'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiBookmark className="h-4 w-4" />
                Bookmarks ({bookmarks.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('highlights')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'highlights'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiHighlight className="h-4 w-4" />
                Highlights ({highlights.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('annotations')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'annotations'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiEdit3 className="h-4 w-4" />
                Notes ({annotations.length})
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading...</p>
            </div>
          ) : (
            <>
              {/* Bookmarks Tab */}
              {activeTab === 'bookmarks' && (
                <>
                  {!showBookmarkForm && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowBookmarkForm(true)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition inline-flex items-center gap-2"
                      >
                        <FiPlus className="h-4 w-4" />
                        New Bookmark
                      </button>
                    </div>
                  )}

                  {showBookmarkForm && (
                    <div className="mb-6 p-4 border border-purple-200 rounded-lg bg-purple-50">
                      <h3 className="font-semibold text-gray-900 mb-4">New Bookmark</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bookmark Name *
                          </label>
                          <input
                            type="text"
                            value={bookmarkForm.name}
                            onChange={(e) =>
                              setBookmarkForm({ ...bookmarkForm, name: e.target.value })
                            }
                            placeholder="e.g., Current row, Sleeve decreases"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Page Number *
                          </label>
                          <input
                            type="number"
                            value={bookmarkForm.pageNumber}
                            onChange={(e) =>
                              setBookmarkForm({ ...bookmarkForm, pageNumber: e.target.value })
                            }
                            placeholder="e.g., 5"
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes (optional)
                          </label>
                          <textarea
                            value={bookmarkForm.notes}
                            onChange={(e) =>
                              setBookmarkForm({ ...bookmarkForm, notes: e.target.value })
                            }
                            placeholder="Add notes about this bookmark"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Color
                          </label>
                          <input
                            type="color"
                            value={bookmarkForm.color}
                            onChange={(e) =>
                              setBookmarkForm({ ...bookmarkForm, color: e.target.value })
                            }
                            className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                          />
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowBookmarkForm(false);
                              setBookmarkForm({
                                name: '',
                                pageNumber: '',
                                notes: '',
                                color: '#FBBF24',
                              });
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateBookmark}
                            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {bookmarks.length === 0 && !showBookmarkForm ? (
                    <div className="text-center py-12">
                      <FiBookmark className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks yet</h3>
                      <p className="text-gray-500 mb-6">
                        Save your place in the pattern with bookmarks
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div
                                className="w-3 h-3 rounded-full mt-1"
                                style={{ backgroundColor: bookmark.color }}
                              />
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{bookmark.name}</h4>
                                <p className="text-sm text-gray-500 mt-1">Page {bookmark.page_number}</p>
                                {bookmark.notes && (
                                  <p className="text-sm text-gray-600 mt-2">{bookmark.notes}</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteBookmark(bookmark.id, bookmark.name)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Highlights Tab */}
              {activeTab === 'highlights' && (
                <div>
                  {highlights.length === 0 ? (
                    <div className="text-center py-12">
                      <FiHighlight className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No highlights yet</h3>
                      <p className="text-gray-500 mb-6">
                        Highlights must be created directly on the PDF viewer
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {highlights.map((highlight) => (
                        <div
                          key={highlight.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div
                                className="w-3 h-3 rounded mt-1"
                                style={{ backgroundColor: highlight.color, opacity: highlight.opacity }}
                              />
                              <div className="flex-1">
                                <p className="text-sm text-gray-900">Page {highlight.page_number}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Created {new Date(highlight.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteHighlight(highlight.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Annotations Tab */}
              {activeTab === 'annotations' && (
                <>
                  {!showAnnotationForm && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowAnnotationForm(true)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition inline-flex items-center gap-2"
                      >
                        <FiPlus className="h-4 w-4" />
                        New Note
                      </button>
                    </div>
                  )}

                  {showAnnotationForm && (
                    <div className="mb-6 p-4 border border-purple-200 rounded-lg bg-purple-50">
                      <h3 className="font-semibold text-gray-900 mb-4">New Note</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Page Number *
                          </label>
                          <input
                            type="number"
                            value={annotationForm.pageNumber}
                            onChange={(e) =>
                              setAnnotationForm({ ...annotationForm, pageNumber: e.target.value })
                            }
                            placeholder="e.g., 5"
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Note Text *
                          </label>
                          <textarea
                            value={annotationForm.text}
                            onChange={(e) =>
                              setAnnotationForm({ ...annotationForm, text: e.target.value })
                            }
                            placeholder="Add your notes, modifications, or reminders"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowAnnotationForm(false);
                              setAnnotationForm({
                                pageNumber: '',
                                annotationType: 'text',
                                text: '',
                              });
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateAnnotation}
                            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {annotations.length === 0 && !showAnnotationForm ? (
                    <div className="text-center py-12">
                      <FiEdit3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
                      <p className="text-gray-500 mb-6">
                        Add personal notes, modifications, and annotations to your pattern
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {annotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 mb-1">
                                Page {annotation.page_number}
                              </p>
                              <p className="text-sm text-gray-700 mb-2">
                                {annotation.data?.text || '(No text)'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(annotation.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteAnnotation(annotation.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
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
