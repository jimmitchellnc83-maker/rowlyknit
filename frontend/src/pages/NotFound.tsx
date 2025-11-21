import { Link } from 'react-router-dom';
import { FiHome, FiArrowLeft } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Icon */}
        <div className="mb-8">
          <span className="text-9xl font-bold text-gray-200">404</span>
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Page Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          Oops! The page you're looking for doesn't exist or has been moved.
          Don't worry, even the best knitters drop a stitch sometimes.
        </p>

        {/* Navigation Options */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <FiHome size={20} />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            <FiArrowLeft size={20} />
            Go Back
          </button>
        </div>

        {/* Quick Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">Or try one of these:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/projects" className="text-blue-600 hover:underline">
              Projects
            </Link>
            <Link to="/patterns" className="text-blue-600 hover:underline">
              Patterns
            </Link>
            <Link to="/yarn" className="text-blue-600 hover:underline">
              Yarn Stash
            </Link>
            <Link to="/tools" className="text-blue-600 hover:underline">
              Tools
            </Link>
            <Link to="/recipients" className="text-blue-600 hover:underline">
              Recipients
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
