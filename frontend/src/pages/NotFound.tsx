import { Link } from 'react-router-dom';
import { FiHome } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">404</p>
        <h1 className="mt-2 text-4xl font-bold text-gray-900 dark:text-gray-100">
          Page not found
        </h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          We couldn't find the page you were looking for. It may have moved, or the link might be wrong.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <FiHome className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
