import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2, FiPackage, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';

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
}

interface YarnPhoto {
  id: string;
  file_path: string;
  thumbnail_path: string;
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
  const [yarn, setYarn] = useState<Yarn | null>(null);
  const [photos, setPhotos] = useState<YarnPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchYarn();
      fetchPhotos();
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
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!yarn) return null;

  const fullName = [yarn.brand, yarn.line, yarn.name].filter(Boolean).join(' — ');
  const primaryPhoto = photos[activePhotoIndex];
  const isLowStock =
    yarn.low_stock_alert &&
    yarn.yards_remaining !== undefined &&
    yarn.low_stock_threshold !== undefined &&
    yarn.yards_remaining <= yarn.low_stock_threshold;

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
                Low stock — {yarn.yards_remaining} yards remaining
              </div>
            )}
          </div>

          {/* Inventory */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Inventory</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Skeins" value={yarn.skeins_remaining} suffix={yarn.skeins_total ? `/${yarn.skeins_total}` : ''} />
              <StatCard label="Yards" value={yarn.yards_remaining} suffix={yarn.yards_total ? `/${yarn.yards_total}` : ''} />
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

          {/* Purchase info */}
          {(yarn.purchase_date || yarn.purchase_location || yarn.dye_lot) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Purchase Info</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {yarn.purchase_date && (
                  <div>
                    <dt className="text-sm text-gray-500">Purchase Date</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{new Date(yarn.purchase_date).toLocaleDateString()}</dd>
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
