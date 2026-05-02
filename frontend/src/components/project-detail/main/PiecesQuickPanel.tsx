import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiLayers } from 'react-icons/fi';
import axios from 'axios';
import {
  PIECE_STATUS_COLOR,
  PIECE_STATUS_LABEL,
  type ProjectPiece,
} from '../../../types/piece.types';

interface Props {
  projectId: string;
}

interface PanelGroupSummary {
  id: string;
  name: string;
  panelCount: number;
}

/**
 * Make Mode pieces strip — fetches the project's pieces and panel
 * groups so the knitter can see which piece is in progress, switch
 * focus quickly, and reach Panel Knitting from inside Make Mode
 * without backtracking to the project detail.
 *
 * Active piece is whichever is `in_progress`. If multiple are in
 * progress, the first by sort order is highlighted; the rest are
 * marked secondary.
 *
 * Renders nothing when the project has no pieces — keeps simple
 * single-piece projects clean.
 */
export default function PiecesQuickPanel({ projectId }: Props) {
  const [pieces, setPieces] = useState<ProjectPiece[]>([]);
  const [panelGroups, setPanelGroups] = useState<PanelGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      axios.get(`/api/projects/${projectId}/pieces`).catch(() => null),
      axios.get(`/api/projects/${projectId}/panel-groups/live`).catch(() => null),
    ])
      .then(([piecesRes, groupsRes]) => {
        if (cancelled) return;
        if (piecesRes) setPieces(piecesRes.data?.data?.pieces ?? []);
        if (groupsRes) setPanelGroups(groupsRes.data?.data?.groups ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) return null;
  if (pieces.length === 0 && panelGroups.length === 0) return null;

  const activePiece = pieces.find((p) => p.status === 'in_progress') ?? null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <FiLayers className="h-4 w-4 text-purple-500" />
          Pieces ({pieces.length})
        </h3>
        {panelGroups.length > 0 && (
          <Link
            to={`/projects/${projectId}/panels`}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            title="Open Panel Knitting (multi-panel master counter)"
          >
            Panel Knitting <FiArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {activePiece && (
        <p className="text-xs text-gray-500 mb-2">
          Active: <span className="font-medium text-gray-800 dark:text-gray-200">{activePiece.name}</span>
        </p>
      )}

      {pieces.length > 0 && (
        <ul className="space-y-1">
          {pieces.map((p) => {
            const isActive = p.id === activePiece?.id;
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm ${
                  isActive
                    ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
                }`}
              >
                <span className="truncate text-gray-800 dark:text-gray-200">
                  {isActive && <span className="text-purple-600 mr-1">●</span>}
                  {p.name}
                  <span className="ml-2 text-xs text-gray-400">{p.type}</span>
                </span>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded ${PIECE_STATUS_COLOR[p.status]}`}
                >
                  {PIECE_STATUS_LABEL[p.status]}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {panelGroups.length > 0 && pieces.length === 0 && (
        <p className="text-xs text-gray-500">
          {panelGroups.length} panel group{panelGroups.length === 1 ? '' : 's'} ready to knit.
        </p>
      )}
    </div>
  );
}
