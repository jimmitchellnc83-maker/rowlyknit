import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2, FiPackage, FiAlertCircle, FiFolder, FiRepeat } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useMeasurementPrefs } from '../hooks/useMeasurementPrefs';
import { formatDate } from '../utils/formatDate';
import { careGlyph, sanitizeCareSymbols, type CareSymbol } from '../utils/careSymbols';

interface Yarn {
  id: string;
  brand: string;
  line?: string;
  name: string;
  color: string;
  color_code?: string;
  weight: string;
  fiber_content: string;
  yards_total?: number;
  yards_remaining?: number;
  total_length_m?: number;
  remaining_length_m?: number;
  grams_total?: number;
  grams_remaining?: number;
  skeins_total?: number;
  skeins_remaining?: number;
  price_per_skein?: number;
  purchase_date?: string;
  purchase_location?: string;
  dye_lot?: string;
  notes?: string;
  description?: string;
  gauge?: string;
  needle_sizes?: string;
  machine_washable?: boolean;
  discontinued?: boolean;
  ravelry_rating?: number;
  ravelry_id?: number;
  low_stock_alert?: boolean;
  low_stock_threshold?: number;
  is_favorite?: boolean;
  created_at?: string;
  updated_at?: string;
  wpi?: number | null;
  care_symbols?: unknown;
}

interface YarnPhoto {
  id: string;
  file_path: string;
  thumbnail_path: string;
}

interface LinkedProject {
  id: string;
  name: string;
  status: string;
  project_type: string | null;
  completion_date: string | null;
  yards_used: number | null;
  skeins_used: number | null;
}

interface RavelryPack {
  id: number;
  name: string | null;
  hex: string | null;
  colorFamily: string | null;
  photoUrl: string | null;
}

const getWeightColor = (weight: string): string => {
  const colors: Record<string, string> = {
    lace: 'bg-pink-100 text-pink-800',
    fingering: 'bg-purple-100 text-purple-800',
    sport: 'bg-blue-100 text-blue-800',
    dk: 'bg-teal-100 text-teal-800',
    worsted: 'bg-green-100 text-green-800',
    bulky: 'bg-yellow-100 text-yellow-800',
    'super-bulky': 'bg-orange-100 text-orange-800',
  };
  return colors[weight] || 'bg-gray-100 text-gray-800';
};

export default function YarnDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fmt, prefs } = useMeasurementPrefs();
  const [yarn, setYarn] = useState<Yarn | null>(null);
  const [photos, setPhotos] = useState<YarnPhoto[]>([]);
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [packs, setPacks] = useState<RavelryPack[] | null>(null);
  const [packsLoading, setPacksLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchYarn();
      fetchPhotos();
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchYarn = async () => {
    try {
      const response = await axios.get(`/api/yarn/${id}`);
      setYarn(response.data.data.yarn);
    } catch {
      toast.error('Failed to load yarn');
      navigate('/yarn');
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async () => {
    try {
      const response = await axios.get(`/api/uploads/yarn/${id}/photos`);
      setPhotos(response.data.data.photos || []);
    } catch {
      // No photos is fine
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`/api/yarn/${id}/projects`);
      setProjects(response.data.data.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  // Fetch Ravelry colorways when this yarn is linked to a Ravelry yarn model.
  // The ravelry_id column is overloaded: stash-imported rows hold a stash
  // entry id (not a yarn-model id), so the /packs endpoint returns 404 and
  // we silently hide the section.
  useEffect(() => {
    if (!yarn?.ravelry_id) {
      setPacks(null);
      return;
    }
    let cancelled = false;
    setPacksLoading(true);
    axios
      .get<{ success: boolean; data: { packs: RavelryPack[] } }>(
        `/api/ravelry/yarns/${yarn.ravelry_id}/packs`
      )
      .then((response) => {
        if (!cancelled) setPacks(response.data.data.packs);
      })
      .catch(() => {
        if (!cancelled) setPacks(null);
      })
      .finally(() => {
        if (!cancelled) setPacksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [yarn?.ravelry_id]);

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/yarn/${id}`);
      toast.success('Yarn deleted');
      navigate('/yarn');
    } catch {
      toast.error('Failed to delete yarn');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading yarn..." />
      </div>
    );
  }

  if (!yarn) return null;

  const fullName = [yarn.brand, yarn.line, yarn.name].filter(Boolean).join(' — ');
  const primaryPhoto = photos[activePhotoIndex];
  const remainingDisplay = fmt.yarnLength(yarn.remaining_length_m ?? (yarn.yards_remaining != null ? yarn.yards_remaining * 0.9144 : null));
  const isLowStock =
    yarn.low_stock_alert &&
    yarn.low_stock_threshold !== undefined &&
    (yarn.remaining_length_m != null
      ? (prefs.yarnLengthDisplayUnit === 'yd' ? yarn.remaining_length_m * 1.09361 : yarn.remaining_length_m) <= yarn.low_stock_threshold
      : (yarn.yards_remaining ?? Infinity) <= yarn.low_stock_threshold);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate('/yarn')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to Stash
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (yarn.weight) params.set('weight', yarn.weight);
              if (yarn.fiber_content) params.set('fiber', yarn.fiber_content);
              if (yarn.yards_remaining != null) params.set('yardage', String(yarn.yards_remaining));
              params.set('returnTo', `/yarn/${id}`);
              navigate(`/calculators/yarn-sub?${params.toString()}`);
            }}
            title="Find what else in your stash could stand in for this yarn"
            className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
          >
            <FiRepeat className="h-4 w-4" />
            Substitute this
          </button>
          <button
            onClick={() => navigate(`/yarn?edit=${id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
          >
            <FiEdit2 className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
          >
            <FiTrash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Photo */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {primaryPhoto ? (
              <div className="w-full aspect-square bg-gray-100">
                <img
                  src={primaryPhoto.file_path}
                  alt={yarn.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                <FiPackage className="h-24 w-24 text-gray-300" />
              </div>
            )}
            {photos.length > 1 && (
              <div className="p-3 flex gap-2 overflow-x-auto">
                {photos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition ${
                      idx === activePhotoIndex ? 'border-purple-500' : 'border-transparent'
                    }`}
                  >
                    <img src={photo.thumbnail_path} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{fullName}</h1>
                {yarn.fiber_content && (
                  <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">{yarn.fiber_content}</p>
                )}
                {yarn.color && (
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-1">
                    Color: {yarn.color}
                    {yarn.color_code && ` (${yarn.color_code})`}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {yarn.weight && (
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getWeightColor(yarn.weight)}`}>
                    {yarn.weight}
                  </span>
                )}
                {yarn.wpi != null && (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {yarn.wpi} WPI
                  </span>
                )}
                {yarn.discontinued && (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-700">
                    Discontinued
                  </span>
                )}
              </div>
            </div>

            {isLowStock && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-800 rounded-lg text-sm">
                <FiAlertCircle className="h-4 w-4" />
                Low stock — {remainingDisplay} remaining
              </div>
            )}
          </div>

          {/* Inventory */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Inventory</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Skeins" value={yarn.skeins_remaining} suffix={yarn.skeins_total ? `/${yarn.skeins_total}` : ''} />
              <StatCard
                label="Length"
                value={fmt.yarnLength(yarn.remaining_length_m ?? (yarn.yards_remaining != null ? yarn.yards_remaining * 0.9144 : null))}
                suffix={yarn.total_length_m != null || yarn.yards_total != null
                  ? `/${fmt.yarnLength(yarn.total_length_m ?? (yarn.yards_total != null ? yarn.yards_total * 0.9144 : null))}`
                  : ''}
              />
              <StatCard label="Grams" value={yarn.grams_remaining} suffix={yarn.grams_total ? `/${yarn.grams_total}` : ''} />
              {yarn.price_per_skein != null && (
                <StatCard label="Price/Skein" value={`$${Number(yarn.price_per_skein).toFixed(2)}`} />
              )}
            </div>
          </div>

          {/* Specifications */}
          {(yarn.gauge || yarn.needle_sizes || yarn.machine_washable !== undefined || yarn.ravelry_rating != null) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Specifications</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {yarn.gauge && (
                  <div>
                    <dt className="text-sm text-gray-500">Gauge</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{yarn.gauge}</dd>
                  </div>
                )}
                {yarn.needle_sizes && (
                  <div>
                    <dt className="text-sm text-gray-500">Needle Sizes</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{yarn.needle_sizes}</dd>
                  </div>
                )}
                {yarn.machine_washable !== undefined && yarn.machine_washable !== null && (
                  <div>
                    <dt className="text-sm text-gray-500">Machine Washable</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{yarn.machine_washable ? 'Yes' : 'No'}</dd>
                  </div>
                )}
                {yarn.ravelry_rating != null && (
                  <div>
                    <dt className="text-sm text-gray-500">Ravelry Rating</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{Number(yarn.ravelry_rating).toFixed(1)} / 5</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Description */}
          {yarn.description && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Description</h2>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{yarn.description}</div>
            </div>
          )}

          {/* Care symbols */}
          <CareSymbolsCard raw={yarn.care_symbols} />

          {/* Color cards (Ravelry packs) */}
          {yarn.ravelry_id && (packsLoading || (packs && packs.length > 0)) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Color cards</h2>
                {packs && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {packs.length} colorway{packs.length === 1 ? '' : 's'} on Ravelry
                  </span>
                )}
              </div>
              {packsLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading colorways…</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {packs!.map((pack) => (
                    <div key={pack.id} className="flex flex-col items-center text-center">
                      <div
                        className="w-full aspect-square rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden flex items-center justify-center"
                        style={pack.hex ? { backgroundColor: pack.hex } : undefined}
                        title={pack.name || ''}
                      >
                        {pack.photoUrl ? (
                          <img
                            src={pack.photoUrl}
                            alt={pack.name || ''}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      {pack.name && (
                        <span className="mt-1 text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                          {pack.name}
                        </span>
                      )}
                      {pack.colorFamily && !pack.name && (
                        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {pack.colorFamily}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Used in projects */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Used in projects</h2>
            {projectsLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This yarn isn't used in any projects yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {projects.map((p) => {
                  const usageParts: string[] = [];
                  if (p.skeins_used != null) {
                    usageParts.push(`${p.skeins_used} skein${p.skeins_used === 1 ? '' : 's'}`);
                  }
                  if (p.yards_used != null) {
                    usageParts.push(fmt.yarnLength(p.yards_used != null ? p.yards_used * 0.9144 : null));
                  }
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/projects/${p.id}`}
                        className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 -mx-3 px-3 rounded transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FiFolder className="h-4 w-4 text-purple-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                              {p.status && <span className="capitalize">{p.status.replace(/_/g, ' ')}</span>}
                              {p.project_type && <span>· {p.project_type}</span>}
                              {usageParts.length > 0 && <span>· uses {usageParts.join(', ')}</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-purple-600 hover:text-purple-700 flex-shrink-0">View →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Purchase info */}
          {(yarn.purchase_date || yarn.purchase_location || yarn.dye_lot) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Purchase Info</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {yarn.purchase_date && (
                  <div>
                    <dt className="text-sm text-gray-500">Purchase Date</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{formatDate(yarn.purchase_date)}</dd>
                  </div>
                )}
                {yarn.purchase_location && (
                  <div>
                    <dt className="text-sm text-gray-500">Location</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{yarn.purchase_location}</dd>
                  </div>
                )}
                {yarn.dye_lot && (
                  <div>
                    <dt className="text-sm text-gray-500">Dye Lot</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{yarn.dye_lot}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Personal Notes */}
          {yarn.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Notes</h2>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{yarn.notes}</div>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete yarn?"
          message={`Are you sure you want to delete "${yarn.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmLabel="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: any; suffix?: string }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
        {value}
        {suffix && <span className="text-sm text-gray-500 font-normal">{suffix}</span>}
      </div>
    </div>
  );
}

/**
 * Renders the yarn's CYC care symbols as a grid of glyph + label
 * pills. Renders NULL when the yarn has no symbols recorded so the
 * card doesn't show an empty section.
 */
function CareSymbolsCard({ raw }: { raw: unknown }) {
  const symbols = sanitizeCareSymbols(raw, { strict: false });
  if (symbols.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Care</h2>
      <div className="flex flex-wrap gap-2">
        {symbols.map((s: CareSymbol, idx: number) => (
          <span
            key={`${s.category}-${s.modifier ?? 'none'}-${idx}`}
            className={
              s.prohibited
                ? 'inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-800 dark:bg-red-900/20 dark:text-red-300'
                : 'inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }
            title={s.label}
          >
            <span aria-hidden className="font-mono text-base">{careGlyph(s)}</span>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
