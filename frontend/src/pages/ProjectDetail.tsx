import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowLeft, FiEdit2, FiTrash2, FiCalendar, FiClock, FiCheck, FiImage,
  FiPlus, FiX, FiUser, FiAlertCircle, FiMic, FiEye, FiEyeOff
} from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import PhotoGallery from '../components/PhotoGallery';
import FileUpload from '../components/FileUpload';
import CounterHierarchy from '../components/counters/CounterHierarchy';
import { SessionManager, SessionTimer, SessionHistory } from '../components/sessions';
import { useWebSocket } from '../contexts/WebSocketContext';
import { AudioNotes } from '../components/notes/AudioNotes';
import { HandwrittenNotes } from '../components/notes/HandwrittenNotes';
import { StructuredMemoTemplates } from '../components/notes/StructuredMemoTemplates';
import MagicMarkerManager from '../components/magic-markers/MagicMarkerManager';
import LoadingSpinner from '../components/LoadingSpinner';
import PatternPreview from '../components/PatternPreview';
import HelpTooltip from '../components/HelpTooltip';
import ConfirmModal from '../components/ConfirmModal';
import {
  EditProjectModal,
  AddPatternModal,
  UploadPatternModal,
  AddYarnModal,
  AddToolModal,
} from '../components/project-detail/modals';
import type {
  EditProjectFormData,
  NewPatternData,
  AddYarnData,
} from '../components/project-detail/modals';
import { useMeasurements } from '../hooks/useMeasurements';
import { useKnittingMode } from '../contexts/KnittingModeContext';

interface Project {
  id: string;
  name: string;
  description: string;
  project_type: string;
  status: string;
  start_date: string;
  target_completion_date: string;
  completion_date: string;
  notes: string;
  recipient_id?: string;
  photos: any[];
  counters: any[];
  patterns: any[];
  yarn: any[];
  tools: any[];
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { joinProject, leaveProject } = useWebSocket();
  const { fmt } = useMeasurements();

  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  // Knitting Mode state (sourced from context so MainLayout can dim the sidebar)
  const { knittingMode, setKnittingMode } = useKnittingMode();
  const [showKnittingVoiceNotes, setShowKnittingVoiceNotes] = useState(false);
  const [showKnittingHistory, setShowKnittingHistory] = useState(false);

  // Restore per-project Knitting Mode preference on mount / id change.
  // Clear the context flag on unmount so other pages get an un-dimmed sidebar.
  useEffect(() => {
    if (!id) return;
    const saved = localStorage.getItem(`rowly:knittingMode:${id}`);
    if (saved === 'true') setKnittingMode(true);
    return () => setKnittingMode(false);
  }, [id, setKnittingMode]);

  // Notes state
  const [audioNotes, setAudioNotes] = useState<any[]>([]);
  const [structuredMemos, setStructuredMemos] = useState<any[]>([]);
  const [notesTab, setNotesTab] = useState<'audio' | 'handwritten' | 'memos'>('audio');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');

  // Modal states for adding items
  const [showAddPatternModal, setShowAddPatternModal] = useState(false);
  const [showUploadPatternModal, setShowUploadPatternModal] = useState(false);
  const [showAddYarnModal, setShowAddYarnModal] = useState(false);
  const [showAddToolModal, setShowAddToolModal] = useState(false);

  // Available items to add
  const [availablePatterns, setAvailablePatterns] = useState<any[]>([]);
  const [availableYarn, setAvailableYarn] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [availableRecipients, setAvailableRecipients] = useState<any[]>([]);

  useEffect(() => {
    fetchProject();
    fetchPhotos();
    fetchAvailableItems();
    fetchAudioNotes();
    fetchStructuredMemos();

    if (id) {
      joinProject(id);
    }

    return () => {
      if (id) {
        leaveProject(id);
      }
    };
  }, [id, joinProject, leaveProject]);

  // Session and counter state for knitting mode integration
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (knittingMode) {
      fetchSessions();
      checkActiveSession();
    }
  }, [knittingMode]);

  const checkActiveSession = async () => {
    try {
      const response = await axios.get(`/api/projects/${id}/sessions/active`);
      if (response.data.success && response.data.data) {
        setCurrentSession(response.data.data);
      }
    } catch (error) {
      // No active session
      setCurrentSession(null);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`/api/projects/${id}/sessions`);
      setSessions(response.data.success ? response.data.data.sessions || [] : []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
    }
  };

  const fetchProject = async () => {
    try {
      const response = await axios.get(`/api/projects/${id}`);
      setProject(response.data.data.project);
    } catch (error: any) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const [patternsRes, yarnRes, toolsRes, recipientsRes] = await Promise.all([
        axios.get('/api/patterns'),
        axios.get('/api/yarn'),
        axios.get('/api/tools'),
        axios.get('/api/recipients'),
      ]);
      setAvailablePatterns(patternsRes.data.data.patterns || []);
      setAvailableYarn(yarnRes.data.data.yarn || []);
      setAvailableTools(toolsRes.data.data.tools || []);
      setAvailableRecipients(recipientsRes.data.data.recipients || []);
    } catch (error) {
      console.error('Error fetching available items:', error);
    }
  };

  const handleUpdateProject = async (data: EditProjectFormData) => {
    try {
      await axios.put(`/api/projects/${id}`, data);
      toast.success('Project updated successfully!');
      await fetchProject();
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
      throw error;
    }
  };

  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [removeYarnTarget, setRemoveYarnTarget] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/projects/${id}`);
      toast.success('Project deleted successfully');
      navigate('/projects');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    } finally {
      setShowDeleteProjectConfirm(false);
    }
  };

  const handleEditNotes = () => {
    setNotesText(project?.notes || '');
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    try {
      await axios.put(`/api/projects/${id}`, {
        name: project?.name,
        description: project?.description,
        status: project?.status,
        notes: notesText,
      });
      toast.success('Notes saved successfully!');
      setEditingNotes(false);
      fetchProject();
    } catch (error: any) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    }
  };

  const handleCancelNotes = () => {
    setNotesText('');
    setEditingNotes(false);
  };

  // Pattern management
  const handleAddPattern = async (patternId: string) => {
    try {
      await axios.post(`/api/projects/${id}/patterns`, { patternId });
      toast.success('Pattern added to project!');
      await fetchProject();
    } catch (error: any) {
      console.error('Error adding pattern:', error);
      toast.error(error.response?.data?.message || 'Failed to add pattern');
      throw error;
    }
  };

  const handleRemovePattern = async (patternId: string) => {
    try {
      await axios.delete(`/api/projects/${id}/patterns/${patternId}`);
      toast.success('Pattern removed from project');
      fetchProject();
    } catch (error: any) {
      console.error('Error removing pattern:', error);
      toast.error('Failed to remove pattern');
    }
  };

  // Upload new pattern directly from project
  const handleUploadAndAddPattern = async (data: NewPatternData, file: File) => {
    try {
      // Step 1: Create the pattern
      const createResponse = await axios.post('/api/patterns', data);
      const newPattern = createResponse.data.data.pattern;
      toast.success('Pattern created!');

      // Step 2: Upload the file to the pattern
      const fileFormData = new FormData();
      fileFormData.append('file', file);
      fileFormData.append('description', 'Pattern file');

      await axios.post(`/api/uploads/patterns/${newPattern.id}/files`, fileFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('File uploaded!');

      // Step 3: Link the pattern to the project
      await axios.post(`/api/projects/${id}/patterns`, {
        patternId: newPattern.id,
      });
      toast.success('Pattern added to project!');

      await Promise.all([fetchProject(), fetchAvailableItems()]);
    } catch (error: any) {
      console.error('Error uploading pattern:', error);
      toast.error(error.response?.data?.message || 'Failed to upload pattern');
      throw error;
    }
  };

  // Yarn management
  const handleAddYarn = async (data: AddYarnData) => {
    try {
      await axios.post(`/api/projects/${id}/yarn`, data);
      toast.success('Yarn added to project! Stash has been updated.');
      await Promise.all([fetchProject(), fetchAvailableItems()]);
    } catch (error: any) {
      console.error('Error adding yarn:', error);
      toast.error(error.response?.data?.message || 'Failed to add yarn');
      throw error;
    }
  };

  const handleRemoveYarn = async (yarnId: string) => {
    try {
      await axios.delete(`/api/projects/${id}/yarn/${yarnId}`);
      toast.success('Yarn removed and restored to stash');
      fetchProject();
      fetchAvailableItems(); // Refresh to show updated yarn quantities
    } catch (error: any) {
      console.error('Error removing yarn:', error);
      toast.error('Failed to remove yarn');
    } finally {
      setRemoveYarnTarget(null);
    }
  };

  // Tool management
  const handleAddTool = async (toolId: string) => {
    try {
      await axios.post(`/api/projects/${id}/tools`, { toolId });
      toast.success('Tool added to project!');
      await fetchProject();
    } catch (error: any) {
      console.error('Error adding tool:', error);
      toast.error(error.response?.data?.message || 'Failed to add tool');
      throw error;
    }
  };

  const handleRemoveTool = async (toolId: string) => {
    try {
      await axios.delete(`/api/projects/${id}/tools/${toolId}`);
      toast.success('Tool removed from project');
      fetchProject();
    } catch (error: any) {
      console.error('Error removing tool:', error);
      toast.error('Failed to remove tool');
    }
  };

  const fetchPhotos = async () => {
    try {
      const response = await axios.get(`/api/uploads/projects/${id}/photos`);
      setPhotos(response.data.data.photos);
    } catch (error: any) {
      console.error('Error fetching photos:', error);
    }
  };

  const fetchAudioNotes = async () => {
    try {
      const response = await axios.get(`/api/projects/${id}/audio-notes`);
      setAudioNotes(response.data.data.audioNotes || []);
    } catch (error: any) {
      console.error('Error fetching audio notes:', error);
      toast.error('Failed to load audio notes');
    }
  };

  const fetchStructuredMemos = async () => {
    try {
      const response = await axios.get(`/api/projects/${id}/structured-memos`);
      setStructuredMemos(response.data.data.memos || []);
    } catch (error: any) {
      console.error('Error fetching structured memos:', error);
      toast.error('Failed to load structured memos');
    }
  };

  const handleSaveAudioNote = async (audioBlob: Blob, durationSeconds: number, transcription?: string, patternId?: string) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio-note.webm');
    formData.append('durationSeconds', durationSeconds.toString());
    if (transcription) {
      formData.append('transcription', transcription);
    }
    if (patternId) {
      formData.append('patternId', patternId);
    }

    try {
      await axios.post(`/api/projects/${id}/audio-notes`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Audio note saved!');
      fetchAudioNotes();
    } catch (error: any) {
      console.error('Error saving audio note:', error);
      toast.error('Failed to save audio note');
      throw error;
    }
  };

  const handleDeleteAudioNote = async (noteId: string) => {
    try {
      await axios.delete(`/api/projects/${id}/audio-notes/${noteId}`);
      toast.success('Audio note deleted');
      fetchAudioNotes();
    } catch (error: any) {
      console.error('Error deleting audio note:', error);
      toast.error('Failed to delete audio note');
      throw error;
    }
  };

  const handleUpdateAudioTranscription = async (noteId: string, transcription: string) => {
    try {
      await axios.put(`/api/projects/${id}/audio-notes/${noteId}`, { transcription });
      toast.success('Transcription updated');
      fetchAudioNotes();
    } catch (error: any) {
      console.error('Error updating transcription:', error);
      toast.error('Failed to update transcription');
      throw error;
    }
  };

  const handleSaveStructuredMemo = async (templateType: string, data: any) => {
    try {
      await axios.post(`/api/projects/${id}/structured-memos`, {
        templateType,
        data,
      });
      toast.success('Memo saved!');
      fetchStructuredMemos();
    } catch (error: any) {
      console.error('Error saving memo:', error);
      toast.error('Failed to save memo');
      throw error;
    }
  };

  const handleDeleteStructuredMemo = async (memoId: string) => {
    try {
      await axios.delete(`/api/projects/${id}/structured-memos/${memoId}`);
      toast.success('Memo deleted');
      fetchStructuredMemos();
    } catch (error: any) {
      console.error('Error deleting memo:', error);
      toast.error('Failed to delete memo');
      throw error;
    }
  };

  const handleToggleKnittingMode = () => {
    const next = !knittingMode;
    setKnittingMode(next);
    if (id) {
      localStorage.setItem(`rowly:knittingMode:${id}`, String(next));
    }
    if (next) {
      toast.success('Knitting Mode activated! 🧶');
    } else {
      toast.info('Knitting Mode deactivated');
    }
  };

  // Get current counter values for session tracking
  const getCurrentCounterValues = () => {
    const counterValues: Record<string, number> = {};
    if (project?.counters) {
      project.counters.forEach((counter: any) => {
        counterValues[counter.id] = counter.current_count || 0;
      });
    }
    return counterValues;
  };

  const handleStartSession = async (): Promise<any> => {
    try {
      const response = await axios.post(`/api/projects/${id}/sessions/start`, {
        mood: undefined,
        location: undefined,
        notes: 'Knitting session',
      });
      const newSession = response.data.success ? response.data.data.session : response.data;
      setCurrentSession(newSession);
      await fetchSessions();
      toast.success('Knitting session started! 🎉');
      return newSession;
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start session');
      throw error;
    }
  };

  const handleEndSession = async (notes?: string, mood?: string) => {
    if (!currentSession) return;

    try {
      await axios.post(`/api/projects/${id}/sessions/${currentSession.id}/end`, {
        notes,
        mood,
      });
      setCurrentSession(null);
      await fetchSessions();
      toast.success('Session ended and saved!');
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end session');
      throw error;
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await axios.delete(`/api/projects/${id}/sessions/${sessionId}`);
      await fetchSessions();
      toast.success('Session deleted');
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error('Failed to delete session');
    }
  };

  const handlePhotoUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);

    try {
      await axios.post(`/api/uploads/projects/${id}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Photo uploaded successfully!');
      fetchPhotos();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
      throw error;
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    try {
      await axios.delete(`/api/uploads/projects/${id}/photos/${photoId}`);
      toast.success('Photo deleted successfully');
      fetchPhotos();
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'planned':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getYarnPercentage = (y: any) => {
    const remaining = y.yarn_remaining || 0;
    const total = y.yarn_total || 1;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading project..." />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Project not found</p>
        <Link to="/projects" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
          Back to Projects
        </Link>
      </div>
    );
  }

  const selectedRecipient = availableRecipients.find(r => r.id === project.recipient_id);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
        >
          <FiArrowLeft className="mr-2" />
          Back to Projects
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
                  project.status
                )}`}
              >
                {project.status}
              </span>
            </div>
            {project.project_type && (
              <p className="text-gray-600">Type: {project.project_type}</p>
            )}
            {selectedRecipient && (
              <p className="text-gray-600 flex items-center mt-1">
                <FiUser className="mr-2 h-4 w-4" />
                Gift for: {selectedRecipient.first_name} {selectedRecipient.last_name}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleToggleKnittingMode}
              className={`px-4 py-3 md:py-2 rounded-lg transition flex items-center min-h-[48px] md:min-h-0 ${
                knittingMode
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {knittingMode ? <FiEyeOff className="mr-2 h-5 w-5 md:h-4 md:w-4" /> : <FiEye className="mr-2 h-5 w-5 md:h-4 md:w-4" />}
              <span className="text-base md:text-sm">{knittingMode ? 'Exit Knitting Mode' : 'Knitting Mode'}</span>
            </button>
            <HelpTooltip text="A focused view with just your pattern, counters, and timer. Great for active knitting sessions." />
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-3 md:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center min-h-[48px] md:min-h-0"
            >
              <FiEdit2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
              <span className="text-base md:text-sm">Edit</span>
            </button>
            <button
              onClick={() => setShowDeleteProjectConfirm(true)}
              className="px-4 py-3 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center min-h-[48px] md:min-h-0"
            >
              <FiTrash2 className="mr-2 h-5 w-5 md:h-4 md:w-4" />
              <span className="text-base md:text-sm">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Knitting Mode - Full Featured UI */}
      {knittingMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Pattern Preview - Knitting Mode */}
            {project.patterns && project.patterns.length > 0 && (
              <PatternPreview
                patterns={project.patterns}
                mode="knitting"
              />
            )}

            {/* Counters - Large Display */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6">
              <CounterHierarchy projectId={id!} />
            </div>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-4 md:space-y-6">
            {/* Session Timer with Row Tracking */}
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Session Timer</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowKnittingVoiceNotes(!showKnittingVoiceNotes)}
                    className={`p-2 rounded-lg transition ${
                      showKnittingVoiceNotes
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="Voice Notes"
                  >
                    <FiMic className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowKnittingHistory(!showKnittingHistory)}
                    className={`p-2 rounded-lg transition ${
                      showKnittingHistory
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="History"
                  >
                    <FiClock className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <SessionTimer
                projectId={id!}
                currentSession={currentSession}
                onStartSession={handleStartSession}
                onEndSession={handleEndSession}
                getCurrentCounterValues={getCurrentCounterValues}
              />
            </div>

            {/* Voice Notes - Embedded in Knitting Mode */}
            {showKnittingVoiceNotes && (
              <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Voice Notes</h2>
                <AudioNotes
                  projectId={id!}
                  patterns={project?.patterns || []}
                  notes={audioNotes}
                  onSaveNote={handleSaveAudioNote}
                  onDeleteNote={handleDeleteAudioNote}
                  onUpdateTranscription={handleUpdateAudioTranscription}
                />
              </div>
            )}

            {/* Session History - Embedded in Knitting Mode */}
            {showKnittingHistory && sessions.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Session History</h2>
                <SessionHistory sessions={sessions} onDeleteSession={handleDeleteSession} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Normal Mode - Project Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {project.description && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{project.description}</p>
            </div>
          )}

          {/* Pattern Preview Section - Normal Mode */}
          {project.patterns && project.patterns.length > 0 && (
            <PatternPreview
              patterns={project.patterns}
              mode="normal"
            />
          )}

          {/* Photos */}
          <details className="bg-white rounded-lg shadow" open={photos.length > 0 || undefined}>
            <summary className="flex items-center p-6 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
              <FiImage className="h-5 w-5 text-purple-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Project Photos</h2>
              <span className="ml-2 text-sm text-gray-500">({photos.length})</span>
              <span className="ml-auto text-sm text-purple-600">{photos.length === 0 ? 'Click to add photos' : ''}</span>
            </summary>
            <div className="px-6 pb-6">
              <div className="mb-4">
                <FileUpload onUpload={handlePhotoUpload} />
              </div>
              <PhotoGallery photos={photos} onDelete={handlePhotoDelete} />
            </div>
          </details>

          {/* Counters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <CounterHierarchy projectId={id!} />
          </div>

          {/* Magic Markers */}
          <div className="bg-white rounded-lg shadow p-6">
            <MagicMarkerManager
              projectId={id!}
              counters={project?.counters || []}
            />
          </div>

          {/* Session Management */}
          <SessionManager
            projectId={id!}
            totalRows={0}
            getCurrentCounterValues={() => {
              return {};
            }}
          />

          {/* Notes Section with Tabs */}
          <div id="notes-section" className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 px-6 pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <nav className="flex -mb-px gap-6">
                <button
                  onClick={() => setNotesTab('audio')}
                  className={`pb-3 text-sm font-medium border-b-2 ${
                    notesTab === 'audio'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Audio Notes
                </button>
                <button
                  onClick={() => setNotesTab('handwritten')}
                  className={`pb-3 text-sm font-medium border-b-2 ${
                    notesTab === 'handwritten'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Handwritten
                </button>
                <button
                  onClick={() => setNotesTab('memos')}
                  className={`pb-3 text-sm font-medium border-b-2 ${
                    notesTab === 'memos'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Structured Memos
                </button>
              </nav>
            </div>

            <div className="p-6">
              {notesTab === 'audio' && (
                <AudioNotes
                  projectId={id!}
                  patterns={project?.patterns || []}
                  notes={audioNotes}
                  onSaveNote={handleSaveAudioNote}
                  onDeleteNote={handleDeleteAudioNote}
                  onUpdateTranscription={handleUpdateAudioTranscription}
                />
              )}

              {notesTab === 'handwritten' && (
                <HandwrittenNotes
                  projectId={id!}
                  onSave={async (imageData) => {
                    try {
                      // Convert base64 to blob
                      const response = await fetch(imageData);
                      const blob = await response.blob();

                      const formData = new FormData();
                      formData.append('image', blob, 'handwritten-note.png');

                      await axios.post(`/api/projects/${id}/handwritten-notes`, formData, {
                        headers: {
                          'Content-Type': 'multipart/form-data',
                        },
                      });
                      toast.success('Handwritten note saved!');
                    } catch (error) {
                      console.error('Error saving handwritten note:', error);
                      throw error;
                    }
                  }}
                />
              )}

              {notesTab === 'memos' && (
                <StructuredMemoTemplates
                  projectId={id!}
                  memos={structuredMemos}
                  onSaveMemo={handleSaveStructuredMemo}
                  onDeleteMemo={handleDeleteStructuredMemo}
                />
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Right Column (sticky so it follows scroll) */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-3">
              {project.start_date && (
                <div className="flex items-start">
                  <FiCalendar className="mt-1 mr-3 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Started</p>
                    <p className="text-sm text-gray-600">{formatDate(project.start_date)}</p>
                  </div>
                </div>
              )}
              {project.target_completion_date && (
                <div className="flex items-start">
                  <FiClock className="mt-1 mr-3 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Target Completion</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(project.target_completion_date)}
                    </p>
                  </div>
                </div>
              )}
              {project.completion_date && (
                <div className="flex items-start">
                  <FiCheck className="mt-1 mr-3 h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Completed</p>
                    <p className="text-sm text-gray-600">{formatDate(project.completion_date)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
              {!editingNotes && (
                <button
                  onClick={handleEditNotes}
                  className="text-purple-600 hover:text-purple-700"
                  title="Edit notes"
                >
                  <FiEdit2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {editingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  rows={6}
                  placeholder="Add notes about your project..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm flex items-center justify-center gap-2"
                  >
                    <FiCheck className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelNotes}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm flex items-center justify-center gap-2"
                  >
                    <FiX className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {project.notes ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.notes}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">No notes added yet</p>
                )}
              </div>
            )}
          </div>

          {/* Patterns */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Patterns</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddPatternModal(true)}
                  className="text-purple-600 hover:text-purple-700 text-xs flex items-center gap-1"
                  title="Select existing pattern"
                >
                  <FiPlus className="h-4 w-4" />
                  Select
                </button>
                <button
                  onClick={() => setShowUploadPatternModal(true)}
                  className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 flex items-center gap-1"
                  title="Upload new pattern"
                >
                  <FiPlus className="h-3 w-3" />
                  Upload
                </button>
              </div>
            </div>

            {project.patterns && project.patterns.length > 0 ? (
              <ul className="space-y-2">
                {project.patterns.map((pattern: any) => (
                  <li key={pattern.id} className="flex items-center justify-between text-sm">
                    <Link
                      to={`/patterns/${pattern.id}`}
                      className="text-purple-600 hover:text-purple-700 flex-1"
                    >
                      {pattern.name}
                    </Link>
                    <button
                      onClick={() => handleRemovePattern(pattern.id)}
                      className="text-red-600 hover:text-red-700 ml-2"
                      title="Remove pattern"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No patterns added</p>
            )}
          </div>

          {/* Tools */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Tools</h2>
              <button
                onClick={() => setShowAddToolModal(true)}
                className="text-purple-600 hover:text-purple-700"
                title="Add tool"
              >
                <FiPlus className="h-5 w-5" />
              </button>
            </div>

            {project.tools && project.tools.length > 0 ? (
              <ul className="space-y-2">
                {project.tools.map((tool: any) => (
                  <li key={tool.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 flex-1">
                      {tool.name}
                      {tool.size && <span className="text-gray-500"> ({tool.size})</span>}
                    </span>
                    <button
                      onClick={() => handleRemoveTool(tool.id)}
                      className="text-red-600 hover:text-red-700 ml-2"
                      title="Remove tool"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No tools added</p>
            )}
          </div>

          {/* Yarn Usage */}
          {project.yarn && project.yarn.length > 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Yarn Usage <HelpTooltip text="Track which yarn from your stash you're using in this project and how much." /></h2>
                <button
                  onClick={() => setShowAddYarnModal(true)}
                  className="text-purple-600 hover:text-purple-700"
                  title="Add yarn"
                >
                  <FiPlus className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {project.yarn.map((y: any) => {
                  const percentage = getYarnPercentage(y);
                  const yardsFallback = y.remaining_length_m != null ? Math.round(y.remaining_length_m * 1.09361) : (y.yards_remaining || 0);
                  const isLowStock = y.low_stock_alert && yardsFallback <= (y.low_stock_threshold || 0);

                  return (
                    <div key={y.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <Link
                            to={`/yarn/${y.id}`}
                            className="text-sm font-medium text-purple-600 hover:text-purple-700 hover:underline"
                          >
                            {y.brand} {y.name}
                            {y.color && <span className="text-gray-600"> - {y.color}</span>}
                          </Link>
                          <p className="text-xs text-gray-500">{y.weight}</p>
                        </div>
                        <button
                          onClick={() => setRemoveYarnTarget(y.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove yarn"
                        >
                          <FiX className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Usage Stats */}
                      <div className="space-y-2 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Used in Project</p>
                          <p className="text-xs font-medium text-gray-900">
                            {y.skeins_used || 0} skeins, {fmt.yarnLength(null, y.yards_used || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Remaining in Stash</p>
                          <p className="text-xs font-medium text-gray-900">
                            {y.skeins_remaining || 0} skeins, {fmt.yarnLength(y.remaining_length_m, y.yards_remaining)}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Stash Level</span>
                          <span>{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              percentage < 20 ? 'bg-red-500' : percentage < 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Low Stock Warning */}
                      {isLowStock && (
                        <div className="flex items-center text-orange-600 text-xs mt-2">
                          <FiAlertCircle className="mr-1 h-3 w-3" />
                          Low stock! Only {fmt.yarnLength(y.remaining_length_m, y.yards_remaining)} remaining
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Yarn Usage <HelpTooltip text="Track which yarn from your stash you're using in this project and how much." /></h2>
                <button
                  onClick={() => setShowAddYarnModal(true)}
                  className="text-purple-600 hover:text-purple-700"
                  title="Add yarn"
                >
                  <FiPlus className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500">No yarn added</p>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {showEditModal && (
        <EditProjectModal
          project={project}
          availableRecipients={availableRecipients}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateProject}
        />
      )}

      {showAddPatternModal && (
        <AddPatternModal
          availablePatterns={availablePatterns}
          existingPatternIds={(project.patterns || []).map((p: any) => p.id)}
          onClose={() => setShowAddPatternModal(false)}
          onSubmit={handleAddPattern}
        />
      )}

      {showUploadPatternModal && (
        <UploadPatternModal
          onClose={() => setShowUploadPatternModal(false)}
          onSubmit={handleUploadAndAddPattern}
        />
      )}

      {showAddYarnModal && (
        <AddYarnModal
          availableYarn={availableYarn}
          onClose={() => setShowAddYarnModal(false)}
          onSubmit={handleAddYarn}
        />
      )}

      {showAddToolModal && (
        <AddToolModal
          availableTools={availableTools}
          existingToolIds={(project.tools || []).map((t: any) => t.id)}
          onClose={() => setShowAddToolModal(false)}
          onSubmit={handleAddTool}
        />
      )}

      {showDeleteProjectConfirm && project && (
        <ConfirmModal
          title="Delete project?"
          message={`Delete "${project.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteProjectConfirm(false)}
        />
      )}

      {removeYarnTarget && (
        <ConfirmModal
          title="Remove yarn from project?"
          message="The used amount will be restored to your stash."
          confirmLabel="Remove"
          variant="warning"
          onConfirm={() => handleRemoveYarn(removeYarnTarget)}
          onCancel={() => setRemoveYarnTarget(null)}
        />
      )}
    </div>
  );
}
