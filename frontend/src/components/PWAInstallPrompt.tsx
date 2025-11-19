import { useState, useEffect } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user has dismissed the prompt before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 30 days
    const dismissedUntil = Date.now() + (30 * 24 * 60 * 60 * 1000);
    localStorage.setItem('pwa-install-dismissed', dismissedUntil.toString());
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-purple-200 dark:border-purple-700 p-6 z-50 animate-slide-up"
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-description"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
        aria-label="Dismiss install prompt"
      >
        <FiX className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
            <FiDownload className="h-6 w-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          </div>
        </div>

        <div className="flex-1">
          <h3
            id="pwa-install-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
          >
            Install Rowly App
          </h3>
          <p
            id="pwa-install-description"
            className="text-sm text-gray-600 dark:text-gray-400 mb-4"
          >
            Install Rowly on your device for quick access and offline use!
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition font-medium"
              aria-label="Install Rowly app"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              aria-label="Dismiss for now"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
