import { Link } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiTrash2, FiUser, FiEye, FiEyeOff, FiShare2, FiCopy } from 'react-icons/fi';
import { toast } from 'react-toastify';
import HelpTooltip from '../HelpTooltip';
import { useKnittingMode } from '../../contexts/KnittingModeContext';
import { writeKnittingMode } from '../../utils/knittingModeStorage';

interface ProjectSummary {
  name: string;
  status: string;
  project_type?: string;
}

interface RecipientSummary {
  first_name: string;
  last_name: string;
}

interface ProjectHeaderProps {
  projectId: string;
  project: ProjectSummary;
  selectedRecipient: RecipientSummary | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onDuplicate: () => void;
  duplicating?: boolean;
  isPublic: boolean;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'planned':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function ProjectHeader({
  projectId,
  project,
  selectedRecipient,
  onEdit,
  onDelete,
  onShare,
  onDuplicate,
  duplicating = false,
  isPublic,
}: ProjectHeaderProps) {
  const { knittingMode, setKnittingMode } = useKnittingMode();

  const handleToggleKnittingMode = () => {
    const next = !knittingMode;
    setKnittingMode(next);
    writeKnittingMode(projectId, next);
    if (next) {
      toast.success('Knitting Mode activated! 🧶');
    } else {
      toast.info('Knitting Mode deactivated');
    }
  };

  return (
    <div className="mb-6">
      <Link
        to="/projects"
        className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
      >
        <FiArrowLeft className="mr-2" />
        Back to Projects
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(project.status)}`}
            >
              {project.status}
            </span>
          </div>
          {project.project_type && (
            <p className="text-gray-600">Type: {project.project_type}</p>
          )}
          {selectedRecipient && (
            <p className="text-gray-600 flex items-center mt-1">
              <FiUser className="mr-2 h-4 w-4" />
              Gift for: {selectedRecipient.first_name} {selectedRecipient.last_name}
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleToggleKnittingMode}
            className={`px-4 py-3 md:py-2 rounded-lg transition flex items-center min-h-[48px] md:min-h-0 ${
              knittingMode
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {knittingMode ? (
              <FiEyeOff className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            ) : (
              <FiEye className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            )}
            <span className="text-base md:text-sm">
              {knittingMode ? 'Exit Knitting Mode' : 'Knitting Mode'}
            </span>
          </button>
          <HelpTooltip text="A focused view with just your pattern, counters, and timer. Great for active knitting sessions." />
          <button
            onClick={onShare}
            aria-label={isPublic ? 'Share — currently public' : 'Share — currently private'}
            className={`px-4 py-3 md:py-2 rounded-lg transition flex items-center min-h-[48px] md:min-h-0 ${
              isPublic
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <FiShare2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            <span className="text-base md:text-sm">{isPublic ? 'Public' : 'Share'}</span>
          </button>
          <button
            onClick={onDuplicate}
            disabled={duplicating}
            title="Make a fresh copy with the same pattern, tools, counters, and pieces — but no yarn, photos, or row history."
            className="px-4 py-3 md:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center min-h-[48px] md:min-h-0 disabled:opacity-60"
          >
            <FiCopy className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            <span className="text-base md:text-sm">{duplicating ? 'Copying…' : 'Make this again'}</span>
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-3 md:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center min-h-[48px] md:min-h-0"
          >
            <FiEdit2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            <span className="text-base md:text-sm">Edit</span>
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-3 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center min-h-[48px] md:min-h-0"
          >
            <FiTrash2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
            <span className="text-base md:text-sm">Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
