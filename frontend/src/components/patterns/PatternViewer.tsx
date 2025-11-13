import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  FiZoomIn,
  FiZoomOut,
  FiRotateCw,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiX,
  FiMaximize,
  FiDownload,
  FiBookmark
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import BookmarkManager from './BookmarkManager';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PatternViewerProps {
  fileUrl: string;
  filename: string;
  patternId?: string;
  projectId?: string;
  onClose?: () => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function PatternViewer({ fileUrl, filename, patternId, projectId, onClose }: PatternViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomIndex, setZoomIndex] = useState<number>(2); // Start at 1.0
  const [rotation, setRotation] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showBookmarks, setShowBookmarks] = useState<boolean>(Boolean(patternId));

  const zoomLevel = ZOOM_LEVELS[zoomIndex];

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setCurrentPage(1);
    toast.success(`PDF loaded: ${numPages} pages`);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    toast.error('Failed to load PDF file');
  }

  const handleZoomIn = useCallback(() => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomIndex(prev => prev + 1);
    }
  }, [zoomIndex]);

  const handleZoomOut = useCallback(() => {
    if (zoomIndex > 0) {
      setZoomIndex(prev => prev - 1);
    }
  }, [zoomIndex]);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleNextPage = useCallback(() => {
    if (currentPage < numPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, numPages]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const handlePageJump = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  }, [numPages]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleJumpToBookmark = useCallback((bookmark: any) => {
    setCurrentPage(bookmark.page_number);
    if (bookmark.zoom_level) {
      const zoomIdx = ZOOM_LEVELS.findIndex(z => Math.abs(z - bookmark.zoom_level) < 0.01);
      if (zoomIdx !== -1) {
        setZoomIndex(zoomIdx);
      }
    }
    toast.success(`Jumped to: ${bookmark.name}`);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          handleNextPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          handlePrevPage();
          break;
        case 'Home':
          setCurrentPage(1);
          break;
        case 'End':
          setCurrentPage(numPages);
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setShowSearch(true);
          }
          break;
        case 'Escape':
          setShowSearch(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, handleNextPage, handlePrevPage, handleZoomIn, handleZoomOut]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-800 text-white p-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-lg truncate max-w-md">{filename}</h3>
          <span className="text-sm text-gray-400">
            {numPages > 0 && `${numPages} pages`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Page Navigation */}
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page (←)"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => handlePageJump(parseInt(e.target.value))}
                className="w-14 px-2 py-1 bg-gray-600 text-white text-center rounded border-none focus:ring-2 focus:ring-purple-500"
                min={1}
                max={numPages}
              />
              <span className="text-gray-400">/ {numPages}</span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage >= numPages}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page (→)"
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
            <button
              onClick={handleZoomOut}
              disabled={zoomIndex <= 0}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom out (-)"
            >
              <FiZoomOut className="h-5 w-5" />
            </button>

            <span className="text-sm font-medium w-12 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom in (+)"
            >
              <FiZoomIn className="h-5 w-5" />
            </button>
          </div>

          {/* Additional Controls */}
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-gray-700 rounded-lg"
            title="Rotate clockwise"
          >
            <FiRotateCw className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 hover:bg-gray-700 rounded-lg ${showSearch ? 'bg-gray-700' : ''}`}
            title="Search (Ctrl+F)"
          >
            <FiSearch className="h-5 w-5" />
          </button>

          {patternId && (
            <button
              onClick={() => setShowBookmarks(!showBookmarks)}
              className={`p-2 hover:bg-gray-700 rounded-lg ${showBookmarks ? 'bg-gray-700' : ''}`}
              title="Bookmarks"
            >
              <FiBookmark className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-700 rounded-lg"
            title="Toggle fullscreen"
          >
            <FiMaximize className="h-5 w-5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg ml-2"
              title="Close viewer (Esc)"
            >
              <FiX className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
          <div className="flex items-center gap-3 max-w-md">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search in document..."
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>
            <button
              onClick={() => setShowSearch(false)}
              className="p-2 hover:bg-gray-700 rounded-lg text-white"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Bookmark Sidebar */}
        {showBookmarks && patternId && (
          <div className="w-80 flex-shrink-0 border-r border-gray-700 overflow-y-auto">
            <BookmarkManager
              patternId={patternId}
              projectId={projectId}
              currentPage={currentPage}
              currentZoom={zoomLevel}
              onJumpToBookmark={handleJumpToBookmark}
            />
          </div>
        )}

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-gray-800 p-4">
          <div className="flex justify-center min-h-full">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-screen">
                  <div className="text-white text-lg">Loading PDF...</div>
                </div>
              }
              error={
                <div className="flex items-center justify-center h-screen">
                  <div className="text-red-500 text-lg">Failed to load PDF</div>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                scale={zoomLevel}
                rotate={rotation}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-2xl"
                loading={
                  <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white">Loading page...</div>
                  </div>
                }
              />
            </Document>
          </div>
        </div>
      </div>

      {/* Page Indicator (Mobile) */}
      <div className="md:hidden bg-gray-800 text-white text-center py-2 border-t border-gray-700">
        Page {currentPage} of {numPages}
      </div>
    </div>
  );
}
