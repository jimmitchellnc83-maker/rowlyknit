import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiLayers, FiPlus, FiTrash2, FiCheck, FiMenu } from 'react-icons/fi';
import {
  ProjectPiece,
  PieceStatus,
  PIECE_STATUS_LABEL,
  PIECE_STATUS_COLOR,
  PIECE_TYPE_SUGGESTIONS,
} from '../../types/piece.types';

interface Props {
  projectId: string;
  initialPieces?: ProjectPiece[];
}

const STATUS_OPTIONS: PieceStatus[] = ['not_started', 'in_progress', 'completed', 'blocked'];

export default function PiecesSection({ projectId, initialPieces }: Props) {
  const [pieces, setPieces] = useState<ProjectPiece[]>(initialPieces ?? []);
  const [loading, setLoading] = useState(!initialPieces);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('other');

  const fetchPieces = useCallback(async () => {
    try {
      const res = await axios.get(`/api/projects/${projectId}/pieces`);
      setPieces(res.data.data.pieces);
    } catch (err) {
      console.error('Failed to fetch pieces', err);
      toast.error('Could not load pieces');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!initialPieces) fetchPieces();
  }, [initialPieces, fetchPieces]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await axios.post(`/api/projects/${projectId}/pieces`, {
        name: newName.trim(),
        type: newType,
      });
      setPieces((prev) => [...prev, res.data.data.piece]);
      setNewName('');
      setNewType('other');
      setAdding(false);
    } catch (err) {
      console.error('Create piece failed', err);
      toast.error('Could not create piece');
    }
  };

  const handleStatusChange = async (id: string, status: PieceStatus) => {
    const previous = pieces;
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    try {
      await axios.put(`/api/projects/${projectId}/pieces/${id}`, { status });
    } catch (err) {
      console.error('Update piece status failed', err);
      toast.error('Could not update status');
      setPieces(previous);
    }
  };

  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const previous = pieces;
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    try {
      await axios.put(`/api/projects/${projectId}/pieces/${id}`, { name: trimmed });
    } catch (err) {
      console.error('Rename piece failed', err);
      toast.error('Could not rename piece');
      setPieces(previous);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this piece? Notes attached to it will be removed.')) return;
    const previous = pieces;
    setPieces((prev) => prev.filter((p) => p.id !== id));
    try {
      await axios.delete(`/api/projects/${projectId}/pieces/${id}`);
    } catch (err) {
      console.error('Delete piece failed', err);
      toast.error('Could not delete piece');
      setPieces(previous);
    }
  };

  // Drag-and-drop reorder using HTML5 native DnD (no extra deps)
  const dragSource = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    dragSource.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Required by Firefox to start the drag
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDrop = (targetId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = dragSource.current;
    dragSource.current = null;
    if (!sourceId || sourceId === targetId) return;

    const fromIndex = pieces.findIndex((p) => p.id === sourceId);
    const toIndex = pieces.findIndex((p) => p.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const previous = pieces;
    const next = [...pieces];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setPieces(next);

    try {
      await axios.patch(`/api/projects/${projectId}/pieces/reorder`, {
        order: next.map((p) => p.id),
      });
    } catch (err) {
      console.error('Reorder pieces failed', err);
      toast.error('Could not save new order');
      setPieces(previous);
    }
  };

  const completedCount = pieces.filter((p) => p.status === 'completed').length;

  return (
    <details className="bg-white rounded-lg shadow" open={pieces.length > 0 || undefined}>
      <summary className="flex items-center p-6 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <FiLayers className="h-5 w-5 text-purple-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">Pieces</h2>
        <span className="ml-2 text-sm text-gray-500">
          ({completedCount}/{pieces.length} done)
        </span>
        <span className="ml-auto text-sm text-purple-600">
          {pieces.length === 0 ? 'Click to add pieces (front, back, sleeve…)' : ''}
        </span>
      </summary>

      <div className="px-6 pb-6 space-y-3">
        {loading && <p className="text-sm text-gray-500">Loading pieces…</p>}

        {pieces.map((piece) => (
          <PieceRow
            key={piece.id}
            piece={piece}
            isDragOver={dragOverId === piece.id}
            onDragStart={handleDragStart(piece.id)}
            onDragOver={handleDragOver(piece.id)}
            onDragLeave={() => setDragOverId(null)}
            onDrop={handleDrop(piece.id)}
            onRename={(name) => handleRename(piece.id, name)}
            onStatusChange={(s) => handleStatusChange(piece.id, s)}
            onDelete={() => handleDelete(piece.id)}
          />
        ))}

        {adding ? (
          <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-200">
            <input
              autoFocus
              type="text"
              placeholder="Piece name (e.g., Left sleeve)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
            >
              {PIECE_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
            >
              <FiCheck className="h-4 w-4" /> Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName('');
              }}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-50 rounded"
          >
            <FiPlus className="h-4 w-4" /> Add piece
          </button>
        )}
      </div>
    </details>
  );
}

function PieceRow({
  piece,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onRename,
  onStatusChange,
  onDelete,
}: {
  piece: ProjectPiece;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRename: (name: string) => void;
  onStatusChange: (s: PieceStatus) => void;
  onDelete: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(piece.name);
  const [isDraggable, setIsDraggable] = useState(false);

  const commitName = () => {
    setEditingName(false);
    if (draftName.trim() && draftName.trim() !== piece.name) {
      onRename(draftName);
    } else {
      setDraftName(piece.name);
    }
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 ${
        isDragOver ? 'bg-purple-50 border-purple-300 border-2 rounded' : ''
      }`}
    >
      {/* Drag handle — only this element activates draggable so input/select stay clickable */}
      <button
        type="button"
        onMouseDown={() => setIsDraggable(true)}
        onMouseUp={() => setIsDraggable(false)}
        onMouseLeave={() => setIsDraggable(false)}
        className="p-1 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
        aria-label="Drag to reorder piece"
      >
        <FiMenu className="h-4 w-4" />
      </button>

      <span className="text-xs uppercase tracking-wide text-gray-400 w-16 truncate" title={piece.type}>
        {piece.type}
      </span>

      {editingName ? (
        <input
          autoFocus
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') {
              setDraftName(piece.name);
              setEditingName(false);
            }
          }}
          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
        />
      ) : (
        <button
          onClick={() => setEditingName(true)}
          className="flex-1 text-left text-sm text-gray-900 hover:text-purple-700 truncate"
          title="Click to rename"
        >
          {piece.name}
        </button>
      )}

      <select
        value={piece.status}
        onChange={(e) => onStatusChange(e.target.value as PieceStatus)}
        className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer ${PIECE_STATUS_COLOR[piece.status]}`}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {PIECE_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <button
        onClick={onDelete}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
        title="Delete piece"
      >
        <FiTrash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
