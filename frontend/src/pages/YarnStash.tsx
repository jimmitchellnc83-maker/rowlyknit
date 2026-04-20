import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiPlus, FiTrash2, FiPackage, FiEdit2, FiSearch, FiRefreshCw, FiMoreVertical, FiHeart } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import ConfirmModal from '../components/ConfirmModal';
import ListControls, { applyListControls, type SortOption } from '../components/ListControls';
import { LoadingCardGrid, ErrorState } from '../components/LoadingSpinner';
import { useYarn, useCreateYarn, useUpdateYarn, useDeleteYarn } from '../hooks/useApi';
import HelpTooltip from '../components/HelpTooltip';
import RavelryYarnSearch, { type RavelryYarnImportData } from '../components/RavelryYarnSearch';
import { useMeasurements } from '../hooks/useMeasurements';

interface Yarn {
  id: string;
  brand: string;
  name: string;
  color: string;
  weight: string;
  yards_remaining: number;
  skeins_remaining: number;
  fiber_content: string;
  yards_total?: number;
  total_length_m?: number;
  remaining_length_m?: number;
  skeins_total?: number;
  low_stock_threshold?: number;
  low_stock_alert?: boolean;
  notes?: string;
  description?: string;
  gauge?: string;
  needle_sizes?: string;
  machine_washable?: boolean;
  discontinued?: boolean;
  ravelry_rating?: number;
  thumbnail_path?: string | null;
  photos?: YarnPhoto[];
  is_favorite?: boolean;
}

interface YarnPhoto {
  id: string;
  yarn_id: string;
  file_path: string;
  thumbnail_path: string;
  original_filename: string;
}

const yarnNameKey = (y: Yarn) => `${(y.brand || '').toLowerCase()} ${(y.name || '').toLowerCase()}`;

const YARN_SORT_OPTIONS: SortOption<Yarn>[] = [
  { id: 'recent', label: 'Recently added', compare: () => 0 },
  { id: 'name_asc', label: 'Name (A–Z)', compare: (a, b) => yarnNameKey(a).localeCompare(yarnNameKey(b)) },
  { id: 'skeins_most', label: 'Skeins: most first', compare: (a, b) => (b.skeins_remaining ?? 0) - (a.skeins_remaining ?? 0) },
  { id: 'skeins_least', label: 'Skeins: least first', compare: (a, b) => (a.skeins_remaining ?? 0) - (b.skeins_remaining ?? 0) },
];

export default function YarnStash() {
  const { fmt } = useMeasurements();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const {
    data: yarn = [],
    isLoading: loading,
    isError,
    refetch,
  } = useYarn({
    favorite: showFavoritesOnly,
  }) as {
    data: Yarn[] | undefined;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
  const [search, setSearch] = useState('');
  const [sortId, setSortId] = useState<string>('recent');
  const visibleYarn = useMemo(
    () =>
      applyListControls(yarn, {
        search,
        searchFields: (y) => [y.brand, y.name, y.color, y.fiber_content],
        sort: YARN_SORT_OPTIONS.find((s) => s.id === sortId),
      }),
    [yarn, search, sortId],
  );
  const createYarn = useCreateYarn();
  const updateYarnMutation = useUpdateYarn();
  const deleteYarnMutation = useDeleteYarn();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
  const [editingYarn, setEditingYarn] = useState<Yarn | null>(null);
  const [yarnPhotos, setYarnPhotos] = useState<YarnPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [photoDeleteTarget, setPhotoDeleteTarget] = useState<string | null>(null);
  const [pendingRavelryPhotoUrl, setPendingRavelryPhotoUrl] = useState<string | null>(null);
  const [pendingRavelryExtras, setPendingRavelryExtras] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    name: '',
    color: '',
    weight: 'worsted',
    fiberContent: '',
    yardsTotal: '',
    skeinsTotal: '1',
    lowStockThreshold: '',
    lowStockAlert: false,
    notes: '',
    gauge: '',
    needleSizes: '',
    description: '',
  });

  const closeAllModals = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowRavelrySearch(false);
    setEditingYarn(null);
  }, []);
  useEscapeKey(closeAllModals, showCreateModal || showEditModal || showRavelrySearch);
  const createModalRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(createModalRef, showCreateModal);
  useFocusTrap(editModalRef, showEditModal && !!editingYarn);

  // Open edit modal if ?edit=<id> is in URL (from YarnDetail page)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && yarn.length > 0) {
      const y = yarn.find((item) => item.id === editId);
      if (y) {
        handleEditClick(y);
        setSearchParams({}, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, yarn]);

  const emptyFormData = {
    brand: '',
    name: '',
    color: '',
    weight: 'worsted',
    fiberContent: '',
    yardsTotal: '',
    skeinsTotal: '1',
    lowStockThreshold: '',
    lowStockAlert: false,
    notes: '',
    gauge: '',
    needleSizes: '',
    description: '',
  };

  const handleRavelryImport = (yarnData: RavelryYarnImportData) => {
    setFormData({
      ...emptyFormData,
      brand: yarnData.brand,
      name: yarnData.name,
      weight: yarnData.weight,
      fiberContent: yarnData.fiberContent,
      yardsTotal: yarnData.yardsTotal,
      gauge: yarnData.gauge || '',
      needleSizes: yarnData.needleSizes || '',
      description: yarnData.description || '',
    });
    setPendingRavelryPhotoUrl(yarnData.photoUrl || null);
    setPendingRavelryExtras({
      gramsTotal: yarnData.gramsTotal ? Number(yarnData.gramsTotal) : undefined,
      machineWashable: yarnData.machineWashable,
      discontinued: yarnData.discontinued,
      ravelryId: yarnData.ravelryId,
      ravelryRating: yarnData.ravelryRating,
    });
    setShowCreateModal(true);

    // Inform user about empty fields
    const missing: string[] = [];
    if (!yarnData.fiberContent) missing.push('fiber content');
    if (!yarnData.yardsTotal) missing.push('yardage');
    if (!yarnData.gauge) missing.push('gauge');
    if (missing.length > 0) {
      toast.info(`Imported from Ravelry. You may want to add: ${missing.join(', ')}.`, { autoClose: 6000 });
    } else {
      toast.success('Imported from Ravelry — review and save.');
    }
  };

  const handleCreateYarn = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = pendingRavelryExtras ? { ...formData, ...pendingRavelryExtras } : formData;
    createYarn.mutate(payload as any, {
      onSuccess: async (response: any) => {
        toast.success('Yarn added successfully!');
        setShowCreateModal(false);

        // If we have a pending Ravelry photo URL, download and attach it
        const newYarnId = response?.id;
        if (pendingRavelryPhotoUrl && newYarnId) {
          try {
            await axios.post(`/api/uploads/yarn/${newYarnId}/photos/from-url`, {
              photoUrl: pendingRavelryPhotoUrl,
            });
          } catch (err) {
            console.error('Failed to import Ravelry photo:', err);
          }
        }
        setPendingRavelryPhotoUrl(null);
        setPendingRavelryExtras(null);
        setFormData(emptyFormData);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to add yarn');
      },
    });
  };

  const handleEditClick = async (y: Yarn) => {
    setEditingYarn(y);
    setFormData({
      brand: y.brand || '',
      name: y.name || '',
      color: y.color || '',
      weight: y.weight || 'worsted',
      fiberContent: y.fiber_content || '',
      yardsTotal: y.yards_total?.toString() || '',
      skeinsTotal: y.skeins_total?.toString() || '1',
      lowStockThreshold: y.low_stock_threshold?.toString() || '',
      lowStockAlert: y.low_stock_alert || false,
      notes: y.notes || '',
      gauge: y.gauge || '',
      needleSizes: y.needle_sizes || '',
      description: y.description || '',
    });

    // Fetch photos for this yarn
    try {
      const response = await axios.get(`/api/uploads/yarn/${y.id}/photos`);
      setYarnPhotos(response.data.data.photos || []);
    } catch (error) {
      console.error('Error fetching yarn photos:', error);
      setYarnPhotos([]);
    }

    setShowEditModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingYarn || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await axios.post(`/api/uploads/yarn/${editingYarn.id}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Photo uploaded successfully!');
      setYarnPhotos([...yarnPhotos, response.data.data.photo]);

      // Reset file input
      e.target.value = '';
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error(error.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!editingYarn) return;

    try {
      await axios.delete(`/api/uploads/yarn/${editingYarn.id}/photos/${photoId}`);
      toast.success('Photo deleted successfully');
      setYarnPhotos(yarnPhotos.filter(p => p.id !== photoId));
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    } finally {
      setPhotoDeleteTarget(null);
    }
  };

  const handleUpdateYarn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYarn) return;

    updateYarnMutation.mutate({ id: editingYarn.id, formData }, {
      onSuccess: () => {
        toast.success('Yarn updated successfully!');
        setShowEditModal(false);
        setEditingYarn(null);
        setFormData(emptyFormData);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update yarn');
      },
    });
  };

  const handleDeleteYarn = async (id: string, _name: string) => {
    deleteYarnMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Yarn deleted successfully');
      },
      onError: () => {
        toast.error('Failed to delete yarn');
      },
      onSettled: () => {
        setDeleteTarget(null);
      },
    });
  };

  const getWeightColor = (weight: string) => {
    const colors: { [key: string]: string } = {
      lace: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      fingering: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      sport: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      dk: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      worsted: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      bulky: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[weight?.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Yarn Stash</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your yarn inventory</p>
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Yarn Stash</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your yarn inventory</p>
          </div>
        </div>
        <ErrorState
          title="Couldn't load your yarn stash"
          message="We hit an error fetching your yarn. Check your connection and try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Yarn Stash</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your yarn inventory</p>
        </div>
        <div className="flex gap-3">
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
            Add Yarn
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
                  onClick={() => { setShowMoreMenu(false); navigate('/ravelry/stash/sync'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Sync stash from Ravelry
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setShowMoreMenu(false); navigate('/ravelry/favorites/yarns/sync'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Sync favorited yarns from Ravelry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {yarn.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiPackage className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No yarn in stash</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Start tracking your yarn collection</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiPlus className="mr-2" />
            Add Your First Yarn
          </button>
        </div>
      ) : (
        <>
        <ListControls
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search brand, name, color…"
          sortOptions={YARN_SORT_OPTIONS}
          sortValue={sortId}
          onSortChange={setSortId}
          showFavorites={showFavoritesOnly}
          onShowFavoritesChange={setShowFavoritesOnly}
          resultCount={visibleYarn.length}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleYarn.map((y) => (
            <div
              key={y.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition overflow-hidden flex flex-col relative"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateYarnMutation.mutate({
                    id: y.id,
                    formData: { isFavorite: !y.is_favorite },
                  });
                }}
                className="absolute top-2 right-2 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur shadow hover:bg-white transition"
                aria-label={y.is_favorite ? 'Unfavorite yarn' : 'Favorite yarn'}
                title={y.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <FiHeart
                  className={`h-4 w-4 ${y.is_favorite ? 'text-red-500 fill-current' : 'text-gray-500'}`}
                />
              </button>
              {y.thumbnail_path && (
                <div
                  onClick={() => navigate(`/yarn/${y.id}`)}
                  className="w-full h-48 bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
                >
                  <img
                    src={y.thumbnail_path}
                    alt={y.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div
                onClick={() => navigate(`/yarn/${y.id}`)}
                className="p-6 cursor-pointer flex-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-purple-600 transition">
                      {y.brand && `${y.brand} `}{y.name}
                    </h3>
                    {y.color && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{y.color}</p>
                    )}
                  </div>
                  {y.weight && (
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getWeightColor(
                        y.weight
                      )}`}
                    >
                      {y.weight}
                    </span>
                  )}
                </div>

                {y.fiber_content && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{y.fiber_content}</p>
                )}

                <div className="space-y-2">
                  {y.skeins_remaining !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Skeins:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{y.skeins_remaining}</span>
                    </div>
                  )}
                  {(y.yards_remaining !== undefined || y.remaining_length_m != null) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Length:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {fmt.yarnLength(y.remaining_length_m, y.yards_remaining)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleEditClick(y)}
                    className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition flex items-center justify-center text-sm"
                  >
                    <FiEdit2 className="mr-2 h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: y.id, name: y.name })}
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

      {/* Create Yarn Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-yarn-title"
        >
          <div ref={createModalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 id="create-yarn-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add Yarn to Stash</h2>
            </div>

            <form onSubmit={handleCreateYarn} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Lion Brand"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Yarn Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Wool-Ease"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Navy Blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Weight
                  </label>
                  <select
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="lace">Lace</option>
                    <option value="fingering">Fingering</option>
                    <option value="sport">Sport</option>
                    <option value="dk">DK</option>
                    <option value="worsted">Worsted</option>
                    <option value="bulky">Bulky</option>
                    <option value="super-bulky">Super Bulky</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fiber Content
                </label>
                <input
                  type="text"
                  value={formData.fiberContent}
                  onChange={(e) => setFormData({ ...formData, fiberContent: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., 100% Wool, 80% Acrylic 20% Wool"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Skeins
                  </label>
                  <input
                    type="number"
                    value={formData.skeinsTotal}
                    onChange={(e) => setFormData({ ...formData, skeinsTotal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {fmt.yarnLengthUnit() === 'm' ? 'Meters' : 'Yards'} per Skein
                  </label>
                  <input
                    type="number"
                    value={formData.yardsTotal}
                    onChange={(e) => setFormData({ ...formData, yardsTotal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 364"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gauge
                  </label>
                  <input
                    type="text"
                    value={formData.gauge}
                    onChange={(e) => setFormData({ ...formData, gauge: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 20 sts over 4 inches"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Needle Sizes
                  </label>
                  <input
                    type="text"
                    value={formData.needleSizes}
                    onChange={(e) => setFormData({ ...formData, needleSizes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., US 5 / 3.75 mm"
                  />
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
                  placeholder="Marketing description, fiber notes, etc."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Personal notes about this yarn"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createYarn.isPending}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createYarn.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {createYarn.isPending ? 'Adding…' : 'Add to Stash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Yarn Modal */}
      {showEditModal && editingYarn && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-yarn-title"
        >
          <div ref={editModalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 id="edit-yarn-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Yarn</h2>
            </div>

            <form onSubmit={handleUpdateYarn} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Lion Brand"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Yarn Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Wool-Ease"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Navy Blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Weight
                  </label>
                  <select
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="lace">Lace</option>
                    <option value="fingering">Fingering</option>
                    <option value="sport">Sport</option>
                    <option value="dk">DK</option>
                    <option value="worsted">Worsted</option>
                    <option value="bulky">Bulky</option>
                    <option value="super-bulky">Super Bulky</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fiber Content
                </label>
                <input
                  type="text"
                  value={formData.fiberContent}
                  onChange={(e) => setFormData({ ...formData, fiberContent: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., 100% Wool, 80% Acrylic 20% Wool"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Skeins
                  </label>
                  <input
                    type="number"
                    value={formData.skeinsTotal}
                    onChange={(e) => setFormData({ ...formData, skeinsTotal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {fmt.yarnLengthUnit() === 'm' ? 'Meters' : 'Yards'} per Skein
                  </label>
                  <input
                    type="number"
                    value={formData.yardsTotal}
                    onChange={(e) => setFormData({ ...formData, yardsTotal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 364"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gauge
                  </label>
                  <input
                    type="text"
                    value={formData.gauge}
                    onChange={(e) => setFormData({ ...formData, gauge: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 20 sts over 4 inches"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Needle Sizes
                  </label>
                  <input
                    type="text"
                    value={formData.needleSizes}
                    onChange={(e) => setFormData({ ...formData, needleSizes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., US 5 / 3.75 mm"
                  />
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
                  placeholder="Marketing description, fiber notes, etc."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Personal notes about this yarn"
                  rows={3}
                />
              </div>

              {/* Photo Gallery Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Photos</h3>

                {/* Photo Upload */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Add photo to visualize your yarn
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {uploadingPhoto && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Uploading...</p>
                  )}
                </div>

                {/* Photo Grid */}
                {yarnPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {yarnPhotos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.thumbnail_path}
                          alt={photo.original_filename}
                          className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotoDeleteTarget(photo.id)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete photo"
                        >
                          <FiTrash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {yarnPhotos.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    No photos yet. Upload a photo to see what your yarn looks like!
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Low Stock Alerts <HelpTooltip text="Get notified on your dashboard when your remaining yards drop below this threshold." /></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Low Stock Threshold ({fmt.yarnLengthUnit()})
                    </label>
                    <input
                      type="number"
                      value={formData.lowStockThreshold}
                      onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., 100"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Get notified when yards drop below this amount</p>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lowStockAlert}
                        onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.checked })}
                        className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable low stock alerts</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingYarn(null);
                    setYarnPhotos([]);
                    setFormData(emptyFormData);
                  }}
                  disabled={updateYarnMutation.isPending}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateYarnMutation.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updateYarnMutation.isPending ? 'Updating…' : 'Update Yarn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Yarn"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteYarn(deleteTarget.id, deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {photoDeleteTarget && (
        <ConfirmModal
          title="Delete Photo"
          message="Are you sure you want to delete this photo?"
          confirmLabel="Delete"
          onConfirm={() => handlePhotoDelete(photoDeleteTarget)}
          onCancel={() => setPhotoDeleteTarget(null)}
        />
      )}

      <RavelryYarnSearch
        isOpen={showRavelrySearch}
        onClose={() => setShowRavelrySearch(false)}
        onImport={handleRavelryImport}
      />
    </div>
  );
}
