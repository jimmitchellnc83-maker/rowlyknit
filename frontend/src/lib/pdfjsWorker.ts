/**
 * Single source of truth for the PDF.js worker URL.
 *
 * Importing this module for its side effect wires up
 * `pdfjs.GlobalWorkerOptions.workerSrc` to the worker bundled by Vite
 * out of `pdfjs-dist`, which guarantees the worker version matches the
 * API version. The previous setup hard-coded `/pdf.worker.min.js` to a
 * file in `public/` that was committed once at v3.11.174 and never
 * bumped — once `pdfjs-dist` reached v5, every PDF in production failed
 * to render with an "API/Worker version mismatch" error.
 *
 * Five components need PDF.js (SourceFilePdfViewer, PatternPreview,
 * QuickKeysPanel, ChartAssistanceModal, PatternViewer); all of them
 * should `import './lib/pdfjsWorker'` rather than poking GlobalWorkerOptions
 * directly so they can never drift apart again.
 */
import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
