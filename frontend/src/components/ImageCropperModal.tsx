import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { FiX, FiCheck } from 'react-icons/fi';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
  imageSrc: string;
  aspect?: number;
  filename: string;
  mimeType: string;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  mimeType: string,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Crop failed'))),
      mimeType,
      0.92,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function ImageCropperModal({
  imageSrc,
  aspect,
  filename,
  mimeType,
  onCancel,
  onConfirm,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(dialogRef, true, cancelRef);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [applying, onCancel]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedPixels) return;
    setApplying(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedPixels, mimeType);
      const croppedFile = new File([blob], filename, { type: mimeType });
      onConfirm(croppedFile);
    } catch (err) {
      console.error('Crop failed:', err);
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-cropper-title"
      onClick={(e) => { if (e.target === e.currentTarget && !applying) onCancel(); }}
    >
      <div ref={dialogRef} className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 id="image-cropper-title" className="text-lg font-semibold text-gray-900">Crop photo</h3>
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="Cancel"
            aria-label="Close crop dialog"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="relative bg-gray-900" style={{ height: '60vh' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            restrictPosition={true}
          />
        </div>

        <div className="p-4 border-t space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Zoom: {zoom.toFixed(2)}×
            </label>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              disabled={applying}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!croppedPixels || applying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiCheck className="h-4 w-4" />
              {applying ? 'Cropping…' : 'Apply crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
