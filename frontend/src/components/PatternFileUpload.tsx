import { useState, useRef } from 'react';
import { FiUpload, FiX, FiFile, FiImage, FiFileText, FiDownload, FiTrash2, FiEye } from 'react-icons/fi';
import PatternViewer from './patterns/PatternViewer';

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

interface PatternFileUploadProps {
  files: PatternFile[];
  onUpload: (file: File, description?: string) => Promise<void>;
  onDelete: (fileId: string) => Promise<void>;
  onDownload: (fileId: string, filename: string) => Promise<void>;
  patternId?: string;
}

export default function PatternFileUpload({
  files,
  onUpload,
  onDelete,
  onDownload,
  patternId,
}: PatternFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [viewingFile, setViewingFile] = useState<PatternFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ].join(',');

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = acceptedTypes.split(',').map(t => t.trim());
    if (!validTypes.includes(file.type)) {
      alert(`Invalid file type. Accepted types: PDF, Images, Word documents, and text files`);
      return;
    }

    // Validate file size (25MB max)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 25) {
      alert(`File size exceeds 25MB limit`);
      return;
    }

    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await onUpload(selectedFile, description);
      // Reset after successful upload
      setSelectedFile(null);
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <FiFile className="w-6 h-6 text-red-500" />;
      case 'image':
        return <FiImage className="w-6 h-6 text-blue-500" />;
      case 'document':
        return <FiFileText className="w-6 h-6 text-blue-600" />;
      default:
        return <FiFile className="w-6 h-6 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Upload Pattern Files
        </h3>

        {/* Drag and drop area */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive
              ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-pink-400 dark:hover:border-pink-500'
            }
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <FiUpload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            PDF, Images, Word documents, or text files (MAX. 25MB)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={acceptedTypes}
            onChange={handleInputChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
          >
            Select File
          </button>
        </div>

        {/* Selected file preview */}
        {selectedFile && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <FiFile className="w-6 h-6 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Description input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g., Main pattern, Size chart, Assembly instructions..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        )}
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Pattern Files ({files.length})
          </h3>

          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-650 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  {getFileIcon(file.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {file.original_filename}
                    </p>
                    {file.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {file.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {formatFileSize(file.size)} • {new Date(file.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {file.file_type === 'pdf' && patternId && (
                    <button
                      onClick={() => setViewingFile(file)}
                      className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                      title="View PDF"
                    >
                      <FiEye className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => onDownload(file.id, file.original_filename)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Download"
                  >
                    <FiDownload className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this file?')) {
                        onDelete(file.id);
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {viewingFile && viewingFile.file_type === 'pdf' && patternId && (
        <PatternViewer
          fileUrl={`/api/uploads/patterns/${patternId}/files/${viewingFile.id}/download`}
          filename={viewingFile.original_filename}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}
