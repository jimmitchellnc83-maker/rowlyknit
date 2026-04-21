import { FiImage } from 'react-icons/fi';
import PhotoGallery from '../../PhotoGallery';
import FileUpload from '../../FileUpload';

interface Props {
  photos: any[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (photoId: string) => Promise<void>;
}

export default function ProjectPhotosSection({ photos, onUpload, onDelete }: Props) {
  return (
    <details className="bg-white rounded-lg shadow" open={photos.length > 0 || undefined}>
      <summary className="flex items-center p-6 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <FiImage className="h-5 w-5 text-purple-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">Project Photos</h2>
        <span className="ml-2 text-sm text-gray-500">({photos.length})</span>
        <span className="ml-auto text-sm text-purple-600">{photos.length === 0 ? 'Click to add photos' : ''}</span>
      </summary>
      <div className="px-6 pb-6">
        <div className="mb-4">
          <FileUpload onUpload={onUpload} />
        </div>
        <PhotoGallery photos={photos} onDelete={onDelete} />
      </div>
    </details>
  );
}
