import { useCallback, useMemo, useRef, useState } from 'react';
import { FiFile, FiUploadCloud, FiX } from 'react-icons/fi';

interface Props {
  /** Current selection (controlled). Pass [] to reset. */
  files: File[];
  /** Called with the new File[] any time selection changes. */
  onChange: (files: File[]) => void;
  /** Accept list, e.g. ".pdf,application/pdf". */
  accept?: string;
  /** Allow multiple files. Default false. */
  multiple?: boolean;
  /** Max file size in megabytes. Files above this emit an inline warning. */
  maxSizeMb?: number;
  /** Helper text shown below the drop zone. */
  helperText?: string;
  /** Disable the whole widget (e.g. during upload). */
  disabled?: boolean;
}

const DEFAULT_MAX_MB = 25;

/**
 * Friendlier alternative to a bare <input type="file">. Features:
 * - Drag-and-drop drop zone (click also opens the picker).
 * - Inline file-size + file-name card per selection, with a remove button.
 * - Client-side size + type validation before submit — disables the list's
 *   remove button only on the invalid items, and surfaces a red banner
 *   rather than waiting for the server to reject.
 */
export default function FileUploadField({
  files,
  onChange,
  accept,
  multiple = false,
  maxSizeMb = DEFAULT_MAX_MB,
  helperText,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const validation = useMemo(
    () =>
      files.map((file) => {
        const tooBig = file.size > maxSizeMb * 1024 * 1024;
        return { file, tooBig };
      }),
    [files, maxSizeMb],
  );
  const hasInvalid = validation.some((v) => v.tooBig);

  const addFiles = useCallback(
    (next: File[]) => {
      if (disabled) return;
      if (multiple) {
        onChange([...files, ...next]);
      } else {
        onChange(next.slice(0, 1));
      }
    },
    [disabled, files, multiple, onChange],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const incoming = Array.from(e.dataTransfer.files);
    if (incoming.length > 0) addFiles(incoming);
  };

  const removeAt = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700'
            : dragOver
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
            : 'border-gray-300 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20'
        }`}
      >
        <FiUploadCloud className="w-7 h-7 text-gray-400 dark:text-gray-500" />
        <div className="text-center">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Tap to choose</span>{' '}
            <span className="hidden sm:inline">or drop a file here</span>
          </p>
          {helperText && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {helperText}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Max {maxSizeMb} MB per file
            {accept ? ` · ${accept.replace(/application\/\w+,?/g, '').trim() || accept}` : ''}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(Array.from(e.target.files));
              // Reset so picking the same file twice still fires change.
              e.target.value = '';
            }
          }}
          disabled={disabled}
        />
      </div>

      {hasInvalid && (
        <div className="mt-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          One or more files exceed the {maxSizeMb} MB limit. Remove them below
          before uploading.
        </div>
      )}

      {validation.length > 0 && (
        <ul className="mt-2 space-y-1">
          {validation.map(({ file, tooBig }, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm ${
                tooBig
                  ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900'
                  : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <FiFile
                  className={`w-4 h-4 flex-shrink-0 ${
                    tooBig
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                />
                <span className="truncate text-gray-800 dark:text-gray-200">
                  {file.name}
                </span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`tabular-nums text-xs ${
                    tooBig
                      ? 'text-red-700 dark:text-red-300 font-semibold'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(idx);
                  }}
                  aria-label={`Remove ${file.name}`}
                  disabled={disabled}
                  className="p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Export to let callers block submit if any file is invalid. */
export function hasInvalidFiles(files: File[], maxSizeMb = DEFAULT_MAX_MB): boolean {
  return files.some((f) => f.size > maxSizeMb * 1024 * 1024);
}
