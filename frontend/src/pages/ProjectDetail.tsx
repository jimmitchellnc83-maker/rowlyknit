import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiClock, FiMic } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import CounterHierarchy from '../components/counters/CounterHierarchy';
import { SessionManager, SessionTimer, SessionHistory } from '../components/sessions';
import { useWebSocket } from '../contexts/WebSocketContext';
import { AudioNotes } from '../components/notes/AudioNotes';
import MagicMarkerManager from '../components/magic-markers/MagicMarkerManager';
import LoadingSpinner from '../components/LoadingSpinner';
import PatternPreview from '../components/PatternPreview';
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
import ProjectHeader from '../components/project-detail/ProjectHeader';
import {
  ProjectTimeline,
  ProjectQuickNotes,
  ProjectPatternsList,
  ProjectToolsList,
  ProjectYarnUsage,
} from '../components/project-detail/sidebar';
import {
  ProjectDescription,
  ProjectPhotosSection,
  ProjectNotesTabs,
} from '../components/project-detail/main';
import { useKnittingMode } from '../contexts/KnittingModeContext';
import { readKnittingMode } from '../utils/knittingModeStorage';

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
    if (readKnittingMode(id)) setKnittingMode(true);
    return () => setKnittingMode(false);
  }, [id, setKnittingMode]);

  // Notes state
  const [audioNotes, setAudioNotes] = useState<any[]>([]);
  const [structuredMemos, setStructuredMemos] = useState<any[]>([]);

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

  const handleSaveProjectNotes = async (notes: string) => {
    await axios.put(`/api/projects/${id}`, {
      name: project?.name,
      description: project?.description,
      status: project?.status,
      notes,
    });
    await fetchProject();
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
      fetchAvailableItems();
    } catch (error: any) {
      console.error('Error removing yarn:', error);
      toast.error('Failed to remove yarn');
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

  const handleSaveHandwrittenNote = async (imageData: string) => {
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
      <ProjectHeader
        projectId={id!}
        project={project}
        selectedRecipient={selectedRecipient}
        onEdit={() => setShowEditModal(true)}
        onDelete={() => setShowDeleteProjectConfirm(true)}
      />

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
          <ProjectDescription description={project.description} />

          {/* Pattern Preview Section - Normal Mode */}
          {project.patterns && project.patterns.length > 0 && (
            <PatternPreview
              patterns={project.patterns}
              mode="normal"
            />
          )}

          <ProjectPhotosSection
            photos={photos}
            onUpload={handlePhotoUpload}
            onDelete={handlePhotoDelete}
          />

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

          <ProjectNotesTabs
            projectId={id!}
            patterns={project?.patterns || []}
            audioNotes={audioNotes}
            structuredMemos={structuredMemos}
            onSaveAudioNote={handleSaveAudioNote}
            onDeleteAudioNote={handleDeleteAudioNote}
            onUpdateAudioTranscription={handleUpdateAudioTranscription}
            onSaveHandwrittenNote={handleSaveHandwrittenNote}
            onSaveStructuredMemo={handleSaveStructuredMemo}
            onDeleteStructuredMemo={handleDeleteStructuredMemo}
          />
        </div>

        {/* Sidebar - Right Column (sticky so it follows scroll) */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <ProjectTimeline
            startDate={project.start_date}
            targetCompletionDate={project.target_completion_date}
            completionDate={project.completion_date}
          />
          <ProjectQuickNotes
            currentNotes={project.notes}
            onSave={handleSaveProjectNotes}
          />
          <ProjectPatternsList
            patterns={project.patterns || []}
            onRemove={handleRemovePattern}
            onSelectClick={() => setShowAddPatternModal(true)}
            onUploadClick={() => setShowUploadPatternModal(true)}
          />
          <ProjectToolsList
            tools={project.tools || []}
            onRemove={handleRemoveTool}
            onAddClick={() => setShowAddToolModal(true)}
          />
          <ProjectYarnUsage
            yarn={project.yarn || []}
            onRemove={handleRemoveYarn}
            onAddClick={() => setShowAddYarnModal(true)}
          />
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
    </div>
  );
}
