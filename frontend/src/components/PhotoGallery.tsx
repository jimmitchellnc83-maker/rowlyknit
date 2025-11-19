import { useState } from 'react';
import { FiX, FiChevronLeft, FiChevronRight, FiTrash2, FiDownload, FiZoomIn, FiZoomOut } from 'react-icons/fi';

interface Photo {
  id: string;
  filename: string;
  thumbnail_path: string;
  file_path: string;
  caption?: string;
  created_at: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  onDelete?: (photoId: string) => void;
}

export default function PhotoGallery({ photos, onDelete }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setZoom(1);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
    setZoom(1);
  };

  const goToPrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
      setZoom(1);
    }
  };

  const goToNext = () => {
    if (selectedIndex !== null && selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
      setZoom(1);
    }
  };

  const handleDownload = (photo: Photo) => {
    const link = document.createElement('a');
    link.href = photo.file_path;
    link.download = photo.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedIndex === null) return;

    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'ArrowRight':
        goToNext();
        break;
      case '+':
      case '=':
        handleZoomIn();
        break;
      case '-':
      case '_':
        handleZoomOut();
        break;
    }
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No photos yet. Upload your first photo!</p>
      </div>
    );
  }

  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  return (
    <>
      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="relative group cursor-pointer aspect-square overflow-hidden rounded-lg bg-gray-100"
            onClick={() => openLightbox(index)}
          >
            <img
              src={photo.thumbnail_path}
              alt={photo.caption || `Photo ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
              <FiZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" />
            </div>

            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Are you sure you want to delete this photo?')) {
                    onDelete(photo.id);
                  }
                }}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition z-10"
            aria-label="Close"
          >
            <FiX className="h-8 w-8" />
          </button>

          {/* Previous Button */}
          {selectedIndex! > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-4 p-3 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition z-10"
              aria-label="Previous"
            >
              <FiChevronLeft className="h-8 w-8" />
            </button>
          )}

          {/* Next Button */}
          {selectedIndex! < photos.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 p-3 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition z-10"
              aria-label="Next"
            >
              <FiChevronRight className="h-8 w-8" />
            </button>
          )}

          {/* Image Container */}
          <div
            className="relative max-w-7xl max-h-full p-4 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.file_path}
              alt={selectedPhoto.caption || 'Photo'}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
            />
          </div>

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-black bg-opacity-75 px-6 py-3 rounded-full z-10">
            {/* Zoom Out */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              disabled={zoom <= 0.5}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Zoom out"
            >
              <FiZoomOut className="h-5 w-5" />
            </button>

            {/* Zoom Indicator */}
            <span className="text-white text-sm font-medium min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>

            {/* Zoom In */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              disabled={zoom >= 3}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Zoom in"
            >
              <FiZoomIn className="h-5 w-5" />
            </button>

            {/* Download */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(selectedPhoto);
              }}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition"
              aria-label="Download"
            >
              <FiDownload className="h-5 w-5" />
            </button>

            {/* Counter */}
            <span className="text-white text-sm">
              {selectedIndex! + 1} / {photos.length}
            </span>
          </div>

          {/* Caption */}
          {selectedPhoto.caption && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 px-6 py-2 rounded-full max-w-2xl">
              <p className="text-white text-sm text-center">{selectedPhoto.caption}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
