import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiExternalLink } from 'react-icons/fi';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Pattern {
  id: string;
  name: string;
  designer?: string;
  description?: string;
}

interface PatternFile {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_type: 'pdf' | 'image' | 'document' | 'other';
  mime_type: string;
}

interface PatternPreviewProps {
  patterns: Pattern[];
  mode?: 'normal' | 'knitting';
}

export default function PatternPreview({ patterns, mode = 'normal' }: PatternPreviewProps) {
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);
  const [patternFiles, setPatternFiles] = useState<PatternFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<PatternFile | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(false);

  // Auto-select first pattern on mount if available
  useEffect(() => {
    if (patterns.length > 0 && !selectedPattern) {
      setSelectedPattern(patterns[0]);
    }
  }, [patterns]);

  // Fetch pattern files when pattern is selected
  useEffect(() => {
    if (selectedPattern) {
      fetchPatternFiles(selectedPattern.id);
    }
  }, [selectedPattern]);

  // Auto-select first PDF file when files are loaded
  useEffect(() => {
    if (patternFiles.length > 0 && !selectedFile) {
      const firstPdf = patternFiles.find(f => f.file_type === 'pdf');
      if (firstPdf) {
        setSelectedFile(firstPdf);
      }
    }
  }, [patternFiles]);

  const fetchPatternFiles = async (patternId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/uploads/patterns/${patternId}/files`);
      const files = response.data.data.files || [];
      setPatternFiles(files);
    } catch (error) {
      console.error('Error fetching pattern files:', error);
      setPatternFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePatternChange = (patternId: string) => {
    const pattern = patterns.find(p => p.id === patternId);
    if (pattern) {
      setSelectedPattern(pattern);
      setSelectedFile(null);
      setPageNumber(1);
    }
  };

  const handleFileChange = (fileId: string) => {
    const file = patternFiles.find(f => f.id === fileId);
    if (file) {
      setSelectedFile(file);
      setPageNumber(1);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const previousPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const nextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages || prev));
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 2.0));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const pdfFiles = patternFiles.filter(f => f.file_type === 'pdf');

  if (patterns.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className={`font-semibold text-gray-900 mb-4 ${mode === 'knitting' ? 'text-xl' : 'text-lg'}`}>
          Pattern Preview
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No patterns linked to this project yet.</p>
          <p className="text-sm mt-2">Add a pattern to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-semibold text-gray-900 ${mode === 'knitting' ? 'text-xl' : 'text-lg'}`}>
            Pattern Preview
          </h3>
          {selectedPattern && (
            <Link
              to={`/patterns/${selectedPattern.id}`}
              className="text-purple-600 hover:text-purple-700 flex items-center gap-1 text-sm"
            >
              Open Full View <FiExternalLink className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Pattern Selector */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Pattern
            </label>
            <select
              value={selectedPattern?.id || ''}
              onChange={(e) => handlePatternChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              {patterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.name} {pattern.designer ? `by ${pattern.designer}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* File Selector - Only show if there are PDF files */}
          {pdfFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select PDF File
              </label>
              <select
                value={selectedFile?.id || ''}
                onChange={(e) => handleFileChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                {pdfFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.original_filename}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Pattern Description */}
        {selectedPattern?.description && (
          <div className="mt-3 p-3 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-700">{selectedPattern.description}</p>
          </div>
        )}
      </div>

      {/* PDF Viewer */}
      {loading ? (
        <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : selectedFile && selectedFile.file_type === 'pdf' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* PDF Controls */}
          <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-2">
              <button
                onClick={previousPage}
                disabled={pageNumber <= 1}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {pageNumber} of {numPages || '?'}
              </span>
              <button
                onClick={nextPage}
                disabled={pageNumber >= (numPages || 0)}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                -
              </button>
              <span className="text-sm text-gray-700">{Math.round(scale * 100)}%</span>
              <button
                onClick={zoomIn}
                disabled={scale >= 2.0}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* PDF Display */}
          <div className="overflow-auto bg-gray-50" style={{ maxHeight: mode === 'knitting' ? '600px' : '500px' }}>
            <Document
              file={`/api/uploads/patterns/${selectedPattern?.id}/files/${selectedFile.id}/download`}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              }
              error={
                <div className="flex items-center justify-center py-12 text-red-600">
                  <p>Failed to load PDF. Please try again.</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        </div>
      ) : pdfFiles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">No PDF files found for this pattern.</p>
          {selectedPattern && (
            <Link
              to={`/patterns/${selectedPattern.id}`}
              className="inline-block mt-2 text-purple-600 hover:text-purple-700 text-sm"
            >
              Upload a PDF file →
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
