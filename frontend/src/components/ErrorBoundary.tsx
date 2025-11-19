import { Component, ErrorInfo, ReactNode } from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 md:p-8">
            <div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-4 md:mb-6">
              <FiAlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-red-600 dark:text-red-400" />
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white text-center mb-3 md:mb-4">
              Something went wrong
            </h2>

            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 text-center mb-6 md:mb-8">
              We're sorry for the inconvenience. The app encountered an unexpected error.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-auto max-h-40 md:max-h-60">
                <p className="text-xs md:text-sm font-mono text-red-600 dark:text-red-400 break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs mt-2 text-gray-600 dark:text-gray-400 overflow-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 md:py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors min-h-[56px] md:min-h-[64px]"
            >
              <FiRefreshCw className="w-5 h-5 md:w-6 md:h-6" />
              <span className="text-base md:text-lg">Reload App</span>
            </button>

            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 text-center mt-4 md:mt-6">
              If this problem persists, please contact support
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
