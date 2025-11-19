import { Outlet } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full px-4">
        <Outlet />
      </div>
    </div>
  );
}
