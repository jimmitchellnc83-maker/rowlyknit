import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import CounterHierarchy from '../components/counters/CounterHierarchy';
import PiecesSection from '../components/project-detail/PiecesSection';
import SectionNav, { type SectionDefinition } from '../components/project-detail/SectionNav';
import DesignCard from '../components/designer/DesignCard';
import type { DesignerFormSnapshot } from '../utils/designerSnapshot';
import { SessionManager } from '../components/sessions';
import { useWebSocket } from '../contexts/WebSocketContext';
import MagicMarkerManager from '../components/magic-markers/MagicMarkerManager';
import LayoutsAndPagesSection from '../components/wave6/LayoutsAndPagesSection';
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
import ShareProjectModal from '../components/project-detail/modals/ShareProjectModal';
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
  NeedleInventoryAlert,
  type NeedleCheckPayload,
  ProjectRatingCard,
  type ProjectRating,
} from '../components/project-detail/sidebar';
import {
  ProjectDescription,
  ProjectPhotosSection,
  ProjectNotesTabs,
  KnittingModeLayout,
} from '../components/project-detail/main';
import { useKnittingMode } from '../contexts/KnittingModeContext';
import { readKnittingMode } from '../utils/knittingModeStorage';
import {
  buildAvailablePatternOptions,
  type PatternPickerKind,
} from '../components/project-detail/availablePatterns';

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
  is_public?: boolean;
  share_slug?: string | null;
  published_at?: string | null;
  public_notes?: boolean;
  photos: any[];
  counters: any[];
  pieces?: any[];
  patterns: any[];
  yarn: any[];
  tools: any[];
  needleCheck?: NeedleCheckPayload | null;
  rating?: ProjectRating | null;
  /** Arbitrary per-project blob — stores designer snapshot, future
   *  integrations (chart-linked counters, etc.). Server returns it parsed. */
  metadata?: { designer?: unknown; [key: string]: unknown } | null;
}

function buildSectionDefinitions(project: Project): SectionDefinition[] {
  const patternCount = project.patterns?.length ?? 0;
  const counterCount = project.counters?.length ?? 0;
  const yarnCount = project.yarn?.length ?? 0;
  const toolCount = project.tools?.length ?? 0;
  const pieceCount = project.pieces?.length ?? 0;
  const trimmedNotes = (project.notes ?? '').trim();
  const needleConflict = project.needleCheck?.status === 'red';
  const missingNeedles = project.needleCheck?.missingSizesMm.length ?? 0;

  const patternsStatus = patternCount > 0 ? 'ready' : 'missing';
  const patternsDetail =
    patternCount > 0
      ? `${patternCount} attached`
      : "Attach the pattern you're following";

  return [
    {
      id: 'description',
      label: 'About',
      visible: !!project.description,
    },
    {
      id: 'design',
      label: 'Design',
      visible: !!project.metadata?.designer,
    },
    {
      id: patternCount > 0 ? 'patterns-preview' : 'patterns-list',
      label: 'Pattern',
      status: patternsStatus,
      detail: patternsDetail,
    },
    {
      id: 'photos',
      label: 'Photos',
    },
    {
      id: 'yarn',
      label: 'Yarn',
      status: yarnCount > 0 ? 'ready' : 'missing',
      detail:
        yarnCount > 0 ? `${yarnCount} assigned` : 'Assign yarn to check feasibility',
    },
    {
      id: 'tools',
      label: 'Tools',
      status: needleConflict
        ? 'conflict'
        : toolCount > 0
        ? 'ready'
        : 'optional',
      detail: needleConflict
        ? `Missing ${missingNeedles} needle size${missingNeedles === 1 ? '' : 's'}`
        : toolCount > 0
        ? `${toolCount} tool${toolCount === 1 ? '' : 's'} assigned`
        : "Tag the needles you're using",
    },
    {
      id: 'pieces',
      label: 'Pieces',
      status: pieceCount > 0 ? 'ready' : 'optional',
      detail:
        pieceCount > 0
          ? `${pieceCount} piece${pieceCount === 1 ? '' : 's'} tracked`
          : 'Break out panels for garments',
    },
    {
      id: 'counters',
      label: 'Counters',
      status: counterCount > 0 ? 'ready' : 'missing',
      detail:
        counterCount > 0
          ? `${counterCount} active`
          : 'Add one to unlock Make Mode',
    },
    {
      id: 'markers',
      label: 'Markers',
    },
    {
      id: 'layouts-pages',
      label: 'Layouts & Pages',
    },
    {
      id: 'sessions',
      label: 'Sessions',
    },
    {
      id: 'notes',
      label: 'Notes',
      status: trimmedNotes.length > 0 ? 'ready' : 'optional',
      detail:
        trimmedNotes.length > 0 ? 'Notes started' : 'Jot setup decisions and mods',
    },
  ];
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { joinProject, leaveProject } = useWebSocket();

  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Knitting Mode state (sourced from context so MainLayout can dim the sidebar)
  const { knittingMode, setKnittingMode } = useKnittingMode();

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
  const [availablePatternModels, setAvailablePatternModels] = useState<any[]>([]);
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
      const [patternsRes, patternModelsRes, yarnRes, toolsRes, recipientsRes] = await Promise.all([
        axios.get('/api/patterns'),
        // Canonical patterns. Errors here shouldn't break the modal —
        // legacy patterns are still attachable. The merge helper drops
        // canonicals that already have a legacy twin, so the fallthrough
        // mirrors what the picker would render with no canonical-only
        // patterns at all.
        axios.get('/api/pattern-models').catch(() => ({ data: { data: [] } })),
        axios.get('/api/yarn'),
        axios.get('/api/tools'),
        axios.get('/api/recipients'),
      ]);
      setAvailablePatterns(patternsRes.data.data.patterns || []);
      setAvailablePatternModels(
        Array.isArray(patternModelsRes.data?.data) ? patternModelsRes.data.data : [],
      );
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
  const [duplicating, setDuplicating] = useState(false);

  const handleDuplicate = async () => {
    if (duplicating || !id) return;
    setDuplicating(true);
    try {
      const res = await axios.post(`/api/projects/${id}/duplicate`);
      const newId = res.data?.data?.project?.id;
      const newName = res.data?.data?.project?.name ?? 'project';
      toast.success(`Copied to "${newName}". Starting at row 1.`);
      if (newId) {
        navigate(`/projects/${newId}`);
      } else {
        await fetchProject();
      }
    } catch (error: any) {
      console.error('Error duplicating project:', error);
      toast.error(error.response?.data?.message || 'Failed to duplicate project');
    } finally {
      setDuplicating(false);
    }
  };

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

  // Pattern management. The selection arrives kind-tagged from the modal
  // so we can route the request body to the correct branch on the
  // backend — `{ patternId }` for legacy patterns (unchanged historical
  // behavior) and `{ patternModelId }` for canonical-only patterns
  // (which the backend resolves through `materializeLegacyStubForCanonical`).
  const handleAddPattern = async (selection: { kind: PatternPickerKind; id: string }) => {
    try {
      const body =
        selection.kind === 'legacy'
          ? { patternId: selection.id }
          : { patternModelId: selection.id };
      await axios.post(`/api/projects/${id}/patterns`, body);
      toast.success('Pattern added to project!');
      await Promise.all([fetchProject(), fetchAvailableItems()]);
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

  const handleSaveHandwrittenNote = async (blob: Blob) => {
    try {
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
        patterns={project.patterns ?? []}
        selectedRecipient={selectedRecipient}
        onEdit={() => setShowEditModal(true)}
        onDelete={() => setShowDeleteProjectConfirm(true)}
        onShare={() => setShowShareModal(true)}
        onDuplicate={handleDuplicate}
        duplicating={duplicating}
        isPublic={!!project.is_public}
      />

      {knittingMode ? (
        <KnittingModeLayout
          projectId={id!}
          patterns={project.patterns || []}
          counters={project.counters || []}
          audioNotes={audioNotes}
          onSaveAudioNote={handleSaveAudioNote}
          onDeleteAudioNote={handleDeleteAudioNote}
          onUpdateAudioTranscription={handleUpdateAudioTranscription}
          linkedChart={
            (project.metadata?.designer as DesignerFormSnapshot | undefined)?.chart ?? null
          }
        />
      ) : (
        <>
          <SectionNav sections={buildSectionDefinitions(project)} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <section id="section-description">
              <ProjectDescription description={project.description} />
            </section>

            {/* Attached design (saved from the Pattern Designer). The
                project's metadata.designer field holds a snapshot of the
                Designer form state at the moment "Save as project" was
                clicked. If it's present, render a summary card with the
                schematic + dimensions + yardage + deep links. */}
            {project.metadata?.designer ? (
              <section id="section-design">
                <DesignCard
                  form={project.metadata.designer as DesignerFormSnapshot}
                  projectId={id!}
                />
              </section>
            ) : null}

            {project.patterns && project.patterns.length > 0 && (
              <section id="section-patterns-preview">
                <PatternPreview
                  patterns={project.patterns}
                  mode="normal"
                  projectId={id!}
                />
              </section>
            )}

            <section id="section-photos">
              <ProjectPhotosSection
                photos={photos}
                onUpload={handlePhotoUpload}
                onDelete={handlePhotoDelete}
              />
            </section>

            <section id="section-pieces">
              <PiecesSection projectId={id!} initialPieces={project?.pieces} />
            </section>

            <section
              id="section-counters"
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <CounterHierarchy
                projectId={id!}
                linkedChart={
                  (project.metadata?.designer as DesignerFormSnapshot | undefined)?.chart ?? null
                }
              />
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  to={`/projects/${id}/panels`}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Guided Pieces →
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Track every piece of a multi-panel pattern with one master counter.
                </p>
              </div>
            </section>

            <section
              id="section-markers"
              className="bg-white rounded-lg shadow p-6"
            >
              <MagicMarkerManager
                projectId={id!}
                counters={project?.counters || []}
              />
            </section>

            <section id="section-layouts-pages">
              <LayoutsAndPagesSection
                projectId={id!}
                patternIds={(project?.patterns ?? []).map((p: { id: string }) => p.id)}
              />
            </section>

            <section id="section-sessions">
              <SessionManager
                projectId={id!}
                totalRows={0}
                getCurrentCounterValues={() => {
                  return {};
                }}
              />
            </section>

            <section id="section-notes">
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
            </section>
          </div>

          {/* Sidebar - Right Column (sticky so it follows scroll) */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <ProjectTimeline
              startDate={project.start_date}
              targetCompletionDate={project.target_completion_date}
              completionDate={project.completion_date}
            />
            {id && (
              <ProjectRatingCard projectId={id} initialRating={project.rating ?? null} />
            )}
            <ProjectQuickNotes
              currentNotes={project.notes}
              onSave={handleSaveProjectNotes}
            />
            <div id="section-patterns-list">
              <ProjectPatternsList
                patterns={project.patterns || []}
                onRemove={handleRemovePattern}
                onSelectClick={() => setShowAddPatternModal(true)}
                onUploadClick={() => setShowUploadPatternModal(true)}
              />
            </div>
            <NeedleInventoryAlert check={project.needleCheck} />
            <div id="section-tools">
              <ProjectToolsList
                tools={project.tools || []}
                onRemove={handleRemoveTool}
                onAddClick={() => setShowAddToolModal(true)}
              />
            </div>
            <div id="section-yarn">
              <ProjectYarnUsage
                yarn={project.yarn || []}
                onRemove={handleRemoveYarn}
                onAddClick={() => setShowAddYarnModal(true)}
              />
            </div>
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

      {showShareModal && (
        <ShareProjectModal
          projectId={id!}
          projectName={project.name}
          initialIsPublic={!!project.is_public}
          initialShareSlug={project.share_slug ?? null}
          initialPublicNotes={!!project.public_notes}
          onClose={() => setShowShareModal(false)}
          onChange={(next) =>
            setProject((prev) =>
              prev
                ? {
                    ...prev,
                    is_public: next.isPublic,
                    share_slug: next.shareSlug,
                    published_at: next.publishedAt,
                    public_notes: next.publicNotes,
                  }
                : prev,
            )
          }
        />
      )}

      {showAddPatternModal && (
        <AddPatternModal
          options={buildAvailablePatternOptions(
            availablePatterns,
            availablePatternModels,
          )}
          existingLegacyIds={(project.patterns || []).map((p: any) => p.id)}
          existingCanonicalIds={(project.patterns || [])
            .map((p: any) => p.canonicalPatternModelId)
            .filter((x: string | null | undefined): x is string => Boolean(x))}
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
