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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listSourceFiles()
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
    // intentional: only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleDelete(sf: SourceFile) {
    if (!window.confirm(`Delete ${sf.originalFilename ?? 'this file'}?`)) return;
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
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
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
        <div className="flex gap-4 flex-1 min-h-0">
          <ul className="w-56 flex-shrink-0 space-y-1 overflow-auto">
            {sourceFiles.map((sf) => (
              <li
                key={sf.id}
                className={`rounded px-2 py-1.5 text-sm flex items-center justify-between gap-2 ${
                  activeId === sf.id
                    ? 'bg-purple-100 dark:bg-purple-900/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(sf.id)}
                  className="flex-1 text-left truncate"
                  title={sf.originalFilename ?? sf.id}
                >
                  {sf.originalFilename ?? '(unnamed)'}
                  <span className="block text-xs text-gray-500">
                    {sf.kind} · {sf.craft}
                    {sf.pageCount ? ` · ${sf.pageCount}p` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(sf)}
                  className="text-xs text-red-600 hover:text-red-800"
                  aria-label="Delete file"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex-1 min-w-0">
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
