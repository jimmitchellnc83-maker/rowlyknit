import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiClock, FiMic, FiMicOff, FiRotateCcw, FiSettings } from 'react-icons/fi';
import { useWebSocket } from '../contexts/WebSocketContext';
import type { LivePanelGroupResponse } from '../types/panel.types';
import MasterCounterControl from '../components/panels/MasterCounterControl';
import PanelCard from '../components/panels/PanelCard';
import HistoryScrubber from '../components/panels/HistoryScrubber';
import PanelMarkerBanner from '../components/panels/PanelMarkerBanner';
import {
  speakAlways,
  usePanelVoiceControl,
} from '../hooks/usePanelVoiceControl';
import {
  resolveReadTarget,
  type PanelVoiceIntent,
} from '../voice/panelCommands';

export default function PanelKnittingView() {
  const { id: projectId, groupId } = useParams<{ id: string; groupId: string }>();
  const navigate = useNavigate();
  const { joinProject, leaveProject, onCounterUpdate, offCounterUpdate } =
    useWebSocket();

  const [live, setLive] = useState<LivePanelGroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [localCollapsed, setLocalCollapsed] = useState<Record<string, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchLive = useCallback(async () => {
    if (!projectId || !groupId) return;
    try {
      const res = await axios.get(
        `/api/projects/${projectId}/panel-groups/${groupId}/live`,
      );
      setLive(res.data.data);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 404) {
        toast.error('Panel group not found');
        navigate(`/projects/${projectId}/panels`);
      } else {
        toast.error('Could not load panel group');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, groupId, navigate]);

  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  useEffect(() => {
    if (!projectId) return;
    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [projectId, joinProject, leaveProject]);

  useEffect(() => {
    if (!live) return;
    const handler = (data: {
      counterId: string;
      projectId: string;
      currentValue: number;
    }) => {
      if (data.counterId === live.master.counter_id) {
        fetchLive();
      }
    };
    onCounterUpdate(handler);
    return () => offCounterUpdate(handler);
  }, [live, onCounterUpdate, offCounterUpdate, fetchLive]);

  const advance = useCallback(
    async (amount: number) => {
      if (!live || !projectId || advancing) return;
      setAdvancing(true);
      try {
        await axios.post(
          `/api/projects/${projectId}/counters/${live.master.counter_id}/increment`,
          { amount, mode: 'independent' },
        );
        await fetchLive();
        if ('vibrate' in navigator) navigator.vibrate(10);
      } catch {
        toast.error('Could not update counter');
      } finally {
        setAdvancing(false);
      }
    },
    [live, projectId, advancing, fetchLive],
  );

  const jumpTo = useCallback(
    async (row: number) => {
      if (!live || !projectId) return;
      setAdvancing(true);
      try {
        await axios.put(
          `/api/projects/${projectId}/counters/${live.master.counter_id}`,
          { currentValue: row, action: 'jump' },
        );
        await fetchLive();
      } catch {
        toast.error('Could not jump to row');
      } finally {
        setAdvancing(false);
      }
    },
    [live, projectId, fetchLive],
  );

  const togglePanelCollapse = (panelId: string) => {
    setLocalCollapsed((prev) => ({ ...prev, [panelId]: !prev[panelId] }));
  };

  const allPanelsEmpty = useMemo(() => {
    if (!live) return false;
    return live.panels.length === 0;
  }, [live]);

  const speakLivePanel = useCallback(
    (panelName: string) => {
      if (!live) return;
      const lowered = panelName.toLowerCase();
      const panel = live.panels.find(
        (p) => p.name.toLowerCase() === lowered,
      );
      if (!panel) {
        speakAlways(`Couldn't find a panel called ${panelName}.`);
        return;
      }
      if (!panel.started) {
        speakAlways(
          `${panel.name} starts in ${panel.rows_until_start} rows.`,
        );
        return;
      }
      const instruction = panel.instruction
        ? panel.instruction
        : 'No instruction set';
      speakAlways(
        `${panel.name}, row ${panel.current_row} of ${panel.repeat_length}. ${instruction}.`,
      );
    },
    [live],
  );

  const speakAllPanels = useCallback(() => {
    if (!live) return;
    const started = live.panels.filter((p) => p.started);
    if (started.length === 0) {
      speakAlways(`Master row ${live.master.current_row}. No panels started.`);
      return;
    }
    const parts = [`Master row ${live.master.current_row}.`];
    for (const panel of started) {
      if (!panel.started) continue;
      const instruction = panel.instruction || 'no instruction';
      parts.push(
        `${panel.name}, row ${panel.current_row}. ${instruction}.`,
      );
    }
    speakAlways(parts.join(' '));
  }, [live]);

  const speakWhereAmI = useCallback(() => {
    if (!live) return;
    const started = live.panels.filter((p) => p.started);
    if (started.length === 0) {
      speakAlways(`Master row ${live.master.current_row}.`);
      return;
    }
    const summary = started
      .map((p) => (p.started ? `${p.name}, row ${p.current_row}` : ''))
      .filter(Boolean)
      .join('. ');
    speakAlways(
      `Master row ${live.master.current_row}. ${summary}.`,
    );
  }, [live]);

  const handleVoiceIntent = useCallback(
    (intent: PanelVoiceIntent) => {
      switch (intent.kind) {
        case 'advance':
          advance(1);
          return;
        case 'retreat':
          advance(-1);
          return;
        case 'jump':
          jumpTo(intent.row);
          return;
        case 'where':
          speakWhereAmI();
          return;
        case 'read':
          if (intent.target === 'all') {
            speakAllPanels();
          } else if (live) {
            const names = live.panels.map((p) => p.name);
            const matchedName = resolveReadTarget(intent.target, names);
            if (matchedName) {
              speakLivePanel(matchedName);
            } else {
              speakAlways(`Couldn't find a panel called ${intent.target}.`);
            }
          }
          return;
        case 'stop':
          // Cancel any in-flight TTS. The user can click the mic button to
          // end listening; "stop" here is the "shut up" button for a
          // too-long read-all mid-narration.
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
          return;
      }
    },
    [advance, jumpTo, speakAllPanels, speakLivePanel, speakWhereAmI, live],
  );

  const voice = usePanelVoiceControl({ onIntent: handleVoiceIntent });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading panels…</p>
      </div>
    );
  }

  if (!live) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-8">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to={`/projects/${projectId}/panels`}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Panels</span>
          </Link>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate mx-2">
            {live.panelGroup.name}
          </h1>
          <Link
            to={`/projects/${projectId}/panels/${groupId}/setup`}
            aria-label="Edit panels"
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <FiSettings className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4">
        <PanelMarkerBanner
          projectId={projectId!}
          counterId={live.master.counter_id}
          currentRow={live.master.current_row}
        />

        <MasterCounterControl
          currentRow={live.master.current_row}
          onAdvance={() => advance(1)}
          onRetreat={() => advance(-1)}
          onJumpTo={jumpTo}
          disabled={advancing}
        />

        {allPanelsEmpty ? (
          <div className="mt-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              This panel group has no panels yet.
            </p>
            <Link
              to={`/projects/${projectId}/panels/${groupId}/setup`}
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
            >
              Add panels
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            {live.panels.map((panel) => (
              <PanelCard
                key={panel.panel_id}
                panel={panel}
                isCollapsed={Boolean(localCollapsed[panel.panel_id])}
                onToggleCollapse={() => togglePanelCollapse(panel.panel_id)}
                onEdit={() =>
                  navigate(
                    `/projects/${projectId}/panels/${groupId}/setup?panel=${panel.panel_id}`,
                  )
                }
              />
            ))}
          </div>
        )}

        <AlignmentDrawer
          lcm={live.lcm}
          rowsUntilAlignment={live.rows_until_full_alignment}
          hasPanels={!allPanelsEmpty}
        />

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => advance(-1)}
            disabled={advancing || live.master.current_row <= 1}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md disabled:opacity-40"
          >
            <FiRotateCcw className="w-4 h-4" />
            Undo last row
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md"
          >
            <FiClock className="w-4 h-4" />
            History
          </button>
          {voice.isSupported && (
            <button
              type="button"
              onClick={voice.toggle}
              aria-pressed={voice.isListening}
              aria-label={voice.isListening ? 'Stop voice control' : 'Start voice control'}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                voice.isListening
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {voice.isListening ? (
                <FiMicOff className="w-4 h-4" />
              ) : (
                <FiMic className="w-4 h-4" />
              )}
              {voice.isListening ? 'Listening…' : 'Voice control'}
            </button>
          )}
          <button
            type="button"
            onClick={speakAllPanels}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md"
          >
            Read all
          </button>
        </div>

        {voice.isListening && voice.lastHeard && (
          <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400 italic">
            Heard: “{voice.lastHeard}”
          </p>
        )}

        {voice.isListening && (
          <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Voice commands</p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <li>“next” · “back”</li>
              <li>“jump to 20”</li>
              <li>“read all”</li>
              <li>“read cable A”</li>
              <li>“where am I”</li>
              <li>“stop”</li>
            </ul>
          </div>
        )}
      </main>

      {historyOpen && (
        <HistoryScrubber
          projectId={projectId!}
          counterId={live.master.counter_id}
          currentRow={live.master.current_row}
          onClose={() => setHistoryOpen(false)}
          onReverted={fetchLive}
        />
      )}
    </div>
  );
}

function AlignmentDrawer({
  lcm,
  rowsUntilAlignment,
  hasPanels,
}: {
  lcm: number;
  rowsUntilAlignment: number;
  hasPanels: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!hasPanels || lcm <= 1) return null;

  return (
    <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Alignment math
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {rowsUntilAlignment.toLocaleString()} rows to next alignment
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
          <p>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {lcm.toLocaleString()}
            </span>{' '}
            rows — LCM of your panel repeats. After this many rows, every panel
            returns to its first row simultaneously.
          </p>
          <p>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {rowsUntilAlignment.toLocaleString()}
            </span>{' '}
            rows until the next full alignment.
          </p>
        </div>
      )}
    </div>
  );
}
