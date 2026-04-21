import { FiCalendar, FiClock, FiCheck } from 'react-icons/fi';

interface Props {
  startDate?: string;
  targetCompletionDate?: string;
  completionDate?: string;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleDateString();
};

export default function ProjectTimeline({ startDate, targetCompletionDate, completionDate }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
      <div className="space-y-3">
        {startDate && (
          <div className="flex items-start">
            <FiCalendar className="mt-1 mr-3 h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Started</p>
              <p className="text-sm text-gray-600">{formatDate(startDate)}</p>
            </div>
          </div>
        )}
        {targetCompletionDate && (
          <div className="flex items-start">
            <FiClock className="mt-1 mr-3 h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Target Completion</p>
              <p className="text-sm text-gray-600">{formatDate(targetCompletionDate)}</p>
            </div>
          </div>
        )}
        {completionDate && (
          <div className="flex items-start">
            <FiCheck className="mt-1 mr-3 h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Completed</p>
              <p className="text-sm text-gray-600">{formatDate(completionDate)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
