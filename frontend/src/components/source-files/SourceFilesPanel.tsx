import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  deleteSourceFile,
  listSourceFiles,
  uploadSourceFile,
  type SourceFile,
} from '../../lib/sourceFiles';
import { trackEvent } from '../../lib/analytics';
import SourceFilePdfViewer from './SourceFilePdfViewer';

/**
 * Wave 2 PR 3 — top-level surface that hosts the SourceFile list, upload,
 * and PDF viewer. Mounts on a project's "Source files" tab.
 *
 * Cross-craft: defaults the upload to the user-passed `defaultCraft`
 * (currently always `'knit'` — when a craft picker lands user-side,
 * the prop will reflect that). UI labels stay craft-neutral.
 */

interface SourceFilesPanelProps {
  /** When set, uploads attach to this project + pattern via project_patterns pin. */
  projectId?: string;
  patternId?: string;
  defaultCraft?: 'knit' | 'crochet';
}

export default function SourceFilesPanel({
  projectId,
  patternId,
  defaultCraft = 'knit',
}: SourceFilesPanelProps) {
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /** Inline confirm for delete — avoids the blocking window.confirm()
   *  which freezes the renderer on iOS. */
  const [pendingDelete, setPendingDelete] = useState<SourceFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Scope the list to the current pattern when one is in context. The
    // unscoped call returns the user's whole file library which made the
    // panel look like a global file dump (PRD doc 03 anti-pattern).
    listSourceFiles(patternId ? { patternId } : undefined)
      .then((rows) => {
        if (cancelled) return;
        setSourceFiles(rows);
        if (rows.length > 0 && !activeId) setActiveId(rows[0].id);
      })
      .catch(() => {
        toast.error('Failed to load source files');
      });
    return () => {
      cancelled = true;
    };
    // intentional: only on mount + when patternId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternId]);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const sf = await uploadSourceFile({
        file,
        craft: defaultCraft,
        kind: file.type.includes('pdf') ? 'pattern_pdf' : 'chart_image',
        projectId,
        patternId,
      });
      setSourceFiles((prev) => [sf, ...prev]);
      setActiveId(sf.id);
      trackEvent('Source File Uploaded', { craft: sf.craft, kind: sf.kind });
      toast.success('File uploaded');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Upload failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function performDelete(sf: SourceFile) {
    setPendingDelete(null);
    try {
      await deleteSourceFile(sf.id);
      setSourceFiles((prev) => prev.filter((s) => s.id !== sf.id));
      if (activeId === sf.id) setActiveId(null);
    } catch {
      toast.error('Failed to delete');
    }
  }

  const active = sourceFiles.find((sf) => sf.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Source files
        </h2>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleFile(file);
                e.target.value = '';
              }
            }}
          />
          {/* Upload is the primary affordance on this panel — keep the
              touch target at the 44px minimum so it's tappable on iPad
              + PWA. Codex review on PR #381 flagged the previous 24px
              vertical (`py-1.5`) as a regression hazard. */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : '+ Upload'}
          </button>
        </div>
      </header>

      {sourceFiles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-8">
          <p className="text-sm text-gray-500 text-center">
            Upload a PDF or chart image to get started.
            <br />
            Drop crop rectangles to bookmark sections.
          </p>
        </div>
      ) : (
        // Stacked column on mobile/tablet so the PDF viewer gets full width.
        // Once the viewport reaches `lg` (~1024px) we shift back to a
        // horizontal layout with a left rail. The rail itself flips from a
        // horizontal scroll strip (compact) on small screens to a vertical
        // sidebar on large screens.
        <div
          data-testid="source-files-layout"
          className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0"
        >
          <ul
            data-testid="source-files-rail"
            className="
              flex lg:flex-col
              gap-2 lg:gap-0 lg:space-y-1
              overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto
              flex-shrink-0
              lg:w-56
              -mx-1 px-1 lg:mx-0 lg:px-0
              pb-2 lg:pb-0
            "
          >
            {sourceFiles.map((sf) => (
              <li
                key={sf.id}
                className={`rounded text-sm flex items-center justify-between gap-2 flex-shrink-0 lg:flex-shrink lg:w-auto w-[180px] sm:w-[220px] ${
                  activeId === sf.id
                    ? 'bg-purple-100 dark:bg-purple-900/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {/* Touch targets on a Source-files row.
                      - File-row open: min-h-[44px] (was px-2 py-1.5 = ~28px).
                      - Delete: 44x44 square so the × is tappable on iPad.
                      - Confirm/Cancel: 44px tall, 44px min-w each.
                    Codex review on PR #381 flagged each of these as below
                    the 44px Apple HIG / Material Material minimum. */}
                <button
                  type="button"
                  onClick={() => setActiveId(sf.id)}
                  className="min-h-[44px] flex-1 text-left truncate min-w-0 px-3 py-2"
                  title={sf.originalFilename ?? sf.id}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{sf.originalFilename ?? '(unnamed)'}</span>
                    {sf.attachmentCount !== undefined && sf.attachmentCount > 1 && (
                      <span
                        className="flex-shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        title={`Attached to ${sf.attachmentCount} patterns`}
                      >
                        Shared
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-gray-500 truncate">
                    {sf.kind} · {sf.craft}
                    {sf.pageCount ? ` · ${sf.pageCount}p` : ''}
                  </span>
                </button>
                {pendingDelete?.id === sf.id ? (
                  <span className="flex items-center gap-1 text-xs flex-shrink-0 pr-1">
                    <button
                      type="button"
                      onClick={() => void performDelete(sf)}
                      data-testid="source-file-delete-confirm"
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded px-2 py-1 font-medium text-red-600 hover:bg-red-50 hover:text-red-800 dark:hover:bg-red-900/20"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      data-testid="source-file-delete-cancel"
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(sf)}
                    className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center text-base text-red-600 hover:bg-red-50 hover:text-red-800 dark:hover:bg-red-900/20 mr-1"
                    aria-label="Delete file"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex-1 min-w-0 min-h-0">
            {active ? (
              <SourceFilePdfViewer
                key={active.id}
                sourceFile={active}
                patternId={patternId}
              />
            ) : (
              <p className="text-sm text-gray-500">Pick a file to view.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
