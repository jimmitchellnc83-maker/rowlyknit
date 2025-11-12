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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-2xl border border-purple-200 p-6 z-50 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition"
        aria-label="Dismiss"
      >
        <FiX className="h-5 w-5" />
      </button>

      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
            <FiDownload className="h-6 w-6 text-purple-600" />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Install Rowly App
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Install Rowly on your device for quick access and offline use!
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
