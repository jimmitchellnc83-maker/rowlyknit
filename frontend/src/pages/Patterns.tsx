import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiBook, FiEdit2, FiSearch, FiMoreVertical, FiRefreshCw, FiHeart, FiCheckCircle, FiFeather } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { PDFCollation } from '../components/patterns';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import ListControls, { applyListControls, type SortOption } from '../components/ListControls';
import { LoadingCardGrid, ErrorState } from '../components/LoadingSpinner';
import { usePatterns, useCreatePattern, useUpdatePattern, useDeletePattern } from '../hooks/useApi';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import RavelryPatternSearch, { type RavelryPatternImportData } from '../components/RavelryPatternSearch';
import PageHelpButton from '../components/PageHelpButton';
import FileUploadField from '../components/forms/FileUploadField';
import { useCreatePatternModel } from '../hooks/usePatternModel';
import { isAuthorModeEnabled } from '../utils/featureFlags';

interface Pattern {
  id: string;
  name: string;
  description: string;
  designer: string;
  difficulty: string;
  category: string;
  thumbnail_url?: string | null;
  created_at: string;
  is_favorite?: boolean;
}

const PATTERN_SORT_OPTIONS: SortOption<Pattern>[] = [
  {
    id: 'recent',
    label: 'Recently added',
    compare: (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
  },
  { id: 'name_asc', label: 'Name (A–Z)', compare: (a, b) => (a.name || '').localeCompare(b.name || '') },
  { id: 'designer', label: 'Designer', compare: (a, b) => (a.designer || '').localeCompare(b.designer || '') },
  { id: 'difficulty', label: 'Difficulty', compare: (a, b) => (a.difficulty || '').localeCompare(b.difficulty || '') },
];

export default function Patterns() {
  const navigate = useNavigate();
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const {
    data: patterns = [],
    isLoading: loading,
    isError,
    refetch,
  } = usePatterns({
    favorite: showFavoritesOnly,
  }) as {
    data: Pattern[] | undefined;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
  const [search, setSearch] = useState('');
  const [sortId, setSortId] = useState<string>('recent');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const { execute: undoableDelete } = useUndoableDelete();
  const visiblePatterns = useMemo(
    () =>
      applyListControls(
        patterns.filter((p: Pattern) => !pendingDeleteIds.has(p.id)),
        {
          search,
          searchFields: (p) => [p.name, p.designer, p.description, p.category],
          sort: PATTERN_SORT_OPTIONS.find((s) => s.id === sortId),
        },
      ),
    [patterns, search, sortId, pendingDeleteIds],
  );
  const createPattern = useCreatePattern();
  const updatePattern = useUpdatePattern();
  const deletePatternMutation = useDeletePattern();
  const createPatternModel = useCreatePatternModel();
  const authorModeEnabled = isAuthorModeEnabled();

  const handleDesignFromScratch = async () => {
    setShowMoreMenu(false);
    try {
      const created = await createPatternModel.mutateAsync({
        name: 'Untitled pattern',
        craft: 'knit',
      });
      toast.success('New pattern created — opening Author Mode…');
      navigate(`/patterns/${created.id}/author`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create pattern';
      toast.error(msg);
    }
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCollationModal, setShowCollationModal] = useState(false);
  const [showRavelrySearch, setShowRavelrySearch] = useState(false);
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
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [patternFiles, setPatternFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [pendingRavelryPhotoUrl, setPendingRavelryPhotoUrl] = useState<string | null>(null);
  const [pendingRavelryExtras, setPendingRavelryExtras] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    designer: '',
    difficulty: 'intermediate',
    category: 'sweater',
  });

  const closeAllModals = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowCollationModal(false);
    setShowRavelrySearch(false);
    setEditingPattern(null);
  }, []);
  useEscapeKey(closeAllModals, showCreateModal || showEditModal || showCollationModal || showRavelrySearch);
  const createModalRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);
  const collationModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(createModalRef, showCreateModal);
  useFocusTrap(editModalRef, showEditModal && !!editingPattern);
  useFocusTrap(collationModalRef, showCollationModal);

  const handleRavelryImport = (patternData: RavelryPatternImportData) => {
    setFormData({
      name: patternData.name,
      description: patternData.description,
      designer: patternData.designer,
      difficulty: patternData.difficulty,
      category: patternData.category,
    });
    setPendingRavelryPhotoUrl(patternData.photoUrl || null);
    setPendingRavelryExtras({
      needleSizes: patternData.needleSizes,
      sizesAvailable: patternData.sizesAvailable,
      yarnRequirements: patternData.yarnRequirements,
      estimatedYardage: patternData.estimatedYardage,
      gauge: patternData.gauge,
      sourceUrl: patternData.sourceUrl,
      source: 'ravelry',
    });
    setShowCreateModal(true);

    const missing: string[] = [];
    if (!patternData.description) missing.push('description');
    if (!patternData.needleSizes) missing.push('needle sizes');
    if (!patternData.gauge) missing.push('gauge');
    if (missing.length > 0) {
      toast.info(`Imported from Ravelry. You may want to add: ${missing.join(', ')}.`, { autoClose: 6000 });
    } else {
      toast.success('Imported from Ravelry — review and save.');
    }
  };

  const handleCreatePattern = async (e: React.FormEvent) => {
    e.preventDefault();

    setUploadingFiles(true);

    const payload = pendingRavelryExtras ? { ...formData, ...pendingRavelryExtras } : formData;

    createPattern.mutate(payload as any, {
      onSuccess: async (newPattern: any) => {
        toast.success('Pattern created!');

        // If we have a pending Ravelry photo URL, download and attach it
        if (pendingRavelryPhotoUrl && newPattern?.id) {
          try {
            await axios.post(`/api/uploads/patterns/${newPattern.id}/thumbnail/from-url`, {
              photoUrl: pendingRavelryPhotoUrl,
            });
          } catch (err) {
            console.error('Failed to import Ravelry photo:', err);
          }
        }
        setPendingRavelryPhotoUrl(null);
        setPendingRavelryExtras(null);

        // Upload PDF files if any
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
        setUploadingFiles(false);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create pattern');
        setUploadingFiles(false);
      },
    });
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

    updatePattern.mutate({ id: editingPattern.id, formData }, {
      onSuccess: () => {
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
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update pattern');
      },
    });
  };

  const handleDeletePattern = (pattern: { id: string; name: string }) => {
    undoableDelete({
      id: pattern.id,
      label: pattern.name,
      optimisticHide: () =>
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.add(pattern.id);
          return next;
        }),
      rollback: () =>
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(pattern.id);
          return next;
        }),
      commit: async () => {
        try {
          await deletePatternMutation.mutateAsync(pattern.id);
        } finally {
          setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(pattern.id);
            return next;
          });
        }
      },
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'advanced':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Patterns</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your knitting pattern library</p>
          </div>
        </div>
        <LoadingCardGrid />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Patterns</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your knitting pattern library</p>
          </div>
        </div>
        <ErrorState
          title="Couldn't load your patterns"
          message="We hit an error fetching your patterns. Check your connection and try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Patterns</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your knitting pattern library</p>
        </div>
        <div className="flex gap-3 items-center">
          <PageHelpButton label="Patterns help" />
          <button
            onClick={() => setShowRavelrySearch(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <FiSearch className="mr-2" />
            Search Ravelry
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            New Pattern
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
                {authorModeEnabled && (
                  <>
                    <button
                      role="menuitem"
                      onClick={handleDesignFromScratch}
                      disabled={createPatternModel.isPending}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiFeather className="h-4 w-4" />
                      {createPatternModel.isPending ? 'Creating…' : 'Design from scratch'}
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                  </>
                )}
                <button
                  role="menuitem"
                  onClick={() => { setShowMoreMenu(false); navigate('/ravelry/sync'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Sync patterns from Ravelry
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setShowMoreMenu(false); navigate('/ravelry/favorites'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FiHeart className="h-4 w-4" />
                  Browse Ravelry favorites
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                <button
                  role="menuitem"
                  onClick={() => { setShowMoreMenu(false); setShowCollationModal(true); }}
                  disabled={patterns.length === 0}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiBook className="h-4 w-4" />
                  Merge PDFs
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {patterns.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiBook className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Save patterns for every cast-on</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 mx-auto max-w-md">
            Upload PDFs, paste from the web, or OCR a photo — Rowly keeps your place row-by-row while you knit.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Add a pattern
          </button>
        </div>
      ) : (
        <>
        <ListControls
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search patterns…"
          sortOptions={PATTERN_SORT_OPTIONS}
          sortValue={sortId}
          onSortChange={setSortId}
          showFavorites={showFavoritesOnly}
          onShowFavoritesChange={setShowFavoritesOnly}
          resultCount={visiblePatterns.length}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visiblePatterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition overflow-hidden relative"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updatePattern.mutate({
                    id: pattern.id,
                    formData: { isFavorite: !pattern.is_favorite },
                  });
                }}
                className="absolute top-2 right-2 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur shadow hover:bg-white transition"
                aria-label={pattern.is_favorite ? 'Unfavorite pattern' : 'Favorite pattern'}
                title={pattern.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <FiHeart
                  className={`h-4 w-4 ${pattern.is_favorite ? 'text-red-500 fill-current' : 'text-gray-500'}`}
                />
              </button>
              {pattern.thumbnail_url && (
                <div
                  onClick={() => navigate(`/patterns/${pattern.id}`)}
                  className="w-full h-48 bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
                >
                  <img
                    src={pattern.thumbnail_url}
                    alt={pattern.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {/* Clickable card area */}
              <div
                onClick={() => navigate(`/patterns/${pattern.id}`)}
                className="cursor-pointer p-6 pb-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1 hover:text-purple-600 transition">
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
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">by {pattern.designer}</p>
                )}

                {pattern.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {pattern.description}
                  </p>
                )}

                {pattern.category && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Category: {pattern.category}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/patterns/${pattern.id}?tab=feasibility`);
                    }}
                    className="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition flex items-center justify-center text-sm"
                    title="Check feasibility against your stash"
                  >
                    <FiCheckCircle className="mr-2 h-4 w-4" />
                    Feasibility
                  </button>
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
                      handleDeletePattern({ id: pattern.id, name: pattern.name });
                    }}
                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition flex items-center justify-center text-sm"
                  >
                    <FiTrash2 className="mr-2 h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Create Pattern Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-pattern-title"
        >
          <div ref={createModalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 id="create-pattern-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add New Pattern</h2>
            </div>

            <form onSubmit={handleCreatePattern} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pattern Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Classic Raglan Sweater"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Designer
                </label>
                <input
                  type="text"
                  value={formData.designer}
                  onChange={(e) => setFormData({ ...formData, designer: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Pattern designer name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Pattern details, notes, etc."
                />
              </div>

              {/* PDF Upload */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pattern PDF Files (Optional)
                </label>
                <FileUploadField
                  files={patternFiles}
                  onChange={setPatternFiles}
                  accept=".pdf,application/pdf"
                  multiple
                  disabled={uploadingFiles}
                  helperText="You can upload multiple PDFs — useful for patterns split across parts."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setPatternFiles([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={uploadingFiles || createPattern.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={uploadingFiles || createPattern.isPending}
                >
                  {uploadingFiles ? 'Creating & Uploading…' : createPattern.isPending ? 'Creating…' : 'Add Pattern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pattern Modal */}
      {showEditModal && editingPattern && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pattern-title"
        >
          <div ref={editModalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 id="edit-pattern-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Pattern</h2>
            </div>

            <form onSubmit={handleUpdatePattern} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pattern Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Classic Raglan Sweater"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Designer
                </label>
                <input
                  type="text"
                  value={formData.designer}
                  onChange={(e) => setFormData({ ...formData, designer: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Pattern designer name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  disabled={updatePattern.isPending}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePattern.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updatePattern.isPending ? 'Updating…' : 'Update Pattern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Collation Modal */}
      {showCollationModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collation-title"
        >
          <div ref={collationModalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 id="collation-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">Merge Pattern PDFs</h2>
              <button
                onClick={() => setShowCollationModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 text-2xl font-bold"
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

      <RavelryPatternSearch
        isOpen={showRavelrySearch}
        onClose={() => setShowRavelrySearch(false)}
        onImport={handleRavelryImport}
      />
    </div>
  );
}
