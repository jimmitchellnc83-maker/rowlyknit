import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FiX, FiFileText, FiZap } from 'react-icons/fi';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { parseYarnLabel, type ParsedYarnLabel } from '../../utils/labelOcrParser';

/**
 * Two-mode yarn-label capture:
 *   - Barcode: live camera stream decoded with ZXing. Emits the scanned
 *     string; the caller decides what to do with it (store as reference,
 *     look up in a product DB, etc.).
 *   - OCR: a single image (file picker, mobile camera capture attribute)
 *     run through Tesseract.js. Extracted dye-lot / color-code / color-name
 *     / weight are suggested back to the caller.
 *
 * Both libraries are dynamically imported so the 4–5 MB Tesseract wasm and
 * the ~500 kB ZXing bundle don't land in the initial JS payload.
 */

interface YarnLabelCaptureProps {
  onClose: () => void;
  onExtracted: (extracted: ExtractedLabelData) => void;
}

export interface ExtractedLabelData {
  dyeLot?: string | null;
  colorCode?: string | null;
  colorName?: string | null;
  weight?: string | null;
  barcode?: string | null;
}

type Tab = 'barcode' | 'ocr';

export default function YarnLabelCapture({ onClose, onExtracted }: YarnLabelCaptureProps) {
  const [tab, setTab] = useState<Tab>('barcode');
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-label-title"
    >
      <div
        ref={modalRef}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800"
      >
        <header className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700 md:p-6">
          <h2 id="scan-label-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Scan Yarn Label
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <nav className="flex border-b border-gray-200 dark:border-gray-700" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'barcode'}
            onClick={() => setTab('barcode')}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
              tab === 'barcode'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiZap className="h-4 w-4" />
            Scan barcode
          </button>
          <button
            role="tab"
            aria-selected={tab === 'ocr'}
            onClick={() => setTab('ocr')}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
              tab === 'ocr'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiFileText className="h-4 w-4" />
            Photo + OCR
          </button>
        </nav>

        <div className="p-4 md:p-6">
          {tab === 'barcode' ? (
            <BarcodeTab onExtracted={onExtracted} onClose={onClose} />
          ) : (
            <OcrTab onExtracted={onExtracted} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barcode
// ---------------------------------------------------------------------------

function BarcodeTab({
  onExtracted,
  onClose,
}: {
  onExtracted: (d: ExtractedLabelData) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<{ reset: () => void } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setStatus('loading');
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader as unknown as { reset: () => void };
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, err) => {
            if (result && !cancelled) {
              setBarcode(result.getText());
              controls.stop();
            }
            // Decode errors fire on every frame that doesn't contain a code;
            // ignore them — they're not actionable.
            void err;
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        readerRef.current = { reset: () => controls.stop() };
        setStatus('scanning');
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.message
            : 'Could not open the camera. Check browser permissions and try again.';
        setError(msg);
        setStatus('error');
      }
    }
    start();
    return () => {
      cancelled = true;
      readerRef.current?.reset();
    };
  }, []);

  const handleUse = () => {
    if (!barcode) return;
    onExtracted({ barcode });
    toast.success('Barcode captured');
    onClose();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Point your camera at the barcode on the yarn label. We&apos;ll capture the code so you
        can keep it on file.
      </p>

      <div className="relative overflow-hidden rounded-lg bg-black" style={{ aspectRatio: '4 / 3' }}>
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          aria-label="Camera preview for barcode scanning"
        />
        {status === 'loading' ? (
          <p className="absolute inset-0 flex items-center justify-center text-white">
            Starting camera…
          </p>
        ) : null}
        {status === 'scanning' ? (
          <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
            Scanning…
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {barcode ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-xs uppercase tracking-wide text-green-700">Captured</p>
          <p className="font-mono text-lg text-green-900">{barcode}</p>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleUse}
          disabled={!barcode}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          Use this barcode
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

function OcrTab({
  onExtracted,
  onClose,
}: {
  onExtracted: (d: ExtractedLabelData) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedYarnLabel | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleFile = async (file: File) => {
    setStatus('running');
    setError(null);
    setParsed(null);
    setProgress(0);
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    try {
      const { default: tesseractModule } = await import('tesseract.js');
      const recognize = (tesseractModule as { recognize: typeof import('tesseract.js').recognize }).recognize;
      const result = await recognize(file, 'eng', {
        logger: (m: { status: string; progress?: number }) => {
          if (typeof m.progress === 'number') setProgress(m.progress);
        },
      });
      const text = result?.data?.text ?? '';
      setParsed(parseYarnLabel(text));
      setStatus('done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'OCR failed. Try a clearer photo.';
      setError(msg);
      setStatus('error');
    }
  };

  const handleUse = () => {
    if (!parsed) return;
    onExtracted({
      dyeLot: parsed.dyeLot,
      colorCode: parsed.colorCode,
      colorName: parsed.colorName,
      weight: parsed.weight,
    });
    toast.success('Label data captured');
    onClose();
  };

  const hasAnyData =
    parsed && (parsed.dyeLot || parsed.colorCode || parsed.colorName || parsed.weight);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Take a clear photo of the yarn label. We&apos;ll extract the dye lot, color code, and
        weight where we can; you can review before saving.
      </p>

      <label className="block">
        <span className="sr-only">Upload label photo</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-purple-700 hover:file:bg-purple-100"
        />
      </label>

      {imageUrl ? (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <img src={imageUrl} alt="Label preview" className="max-h-64 w-full object-contain bg-gray-100" />
        </div>
      ) : null}

      {status === 'running' ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
          <p className="mb-2 text-gray-700">
            Reading label… {Math.round(progress * 100)}%
          </p>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-purple-600 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {parsed && hasAnyData ? (
        <dl className="grid grid-cols-1 gap-3 rounded-lg border border-green-200 bg-green-50 p-4 sm:grid-cols-2">
          {parsed.dyeLot ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-green-700">Dye lot</dt>
              <dd className="font-mono text-gray-900">{parsed.dyeLot}</dd>
            </div>
          ) : null}
          {parsed.colorCode ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-green-700">Color code</dt>
              <dd className="font-mono text-gray-900">{parsed.colorCode}</dd>
            </div>
          ) : null}
          {parsed.colorName ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-green-700">Color name</dt>
              <dd className="text-gray-900">{parsed.colorName}</dd>
            </div>
          ) : null}
          {parsed.weight ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-green-700">Weight</dt>
              <dd className="text-gray-900">{parsed.weight}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {parsed && !hasAnyData ? (
        <p className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          We couldn&apos;t extract structured fields from this photo. Try a clearer shot or
          enter the values manually.
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleUse}
          disabled={!hasAnyData}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          Use extracted fields
        </button>
      </div>

      {status === 'idle' && !imageUrl ? (
        <p className="text-center text-xs text-gray-500">
          Tip: on mobile, tapping the file picker will open your camera directly.
        </p>
      ) : null}
    </div>
  );
}

