import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiBook, FiFolder, FiPackage, FiPlus, FiTool, FiX } from 'react-icons/fi';
import {
  useCreateProject,
  useCreatePattern,
  useCreateYarn,
  useCreateTool,
} from '../../hooks/useApi';
import { useKnittingMode } from '../../contexts/KnittingModeContext';

type CreateType = 'project' | 'yarn' | 'pattern' | 'tool';

/**
 * Floating global quick-create button. Open via the button, the `c` keyboard
 * shortcut (when no input is focused), or programmatically.
 *
 * Each form shows the minimum required fields plus a smart default status/
 * color where applicable. Advanced fields are NOT shown here — users can
 * fill them in from the detail page after the item is created.
 *
 * Stacks above PageHelp's `?` in the same corner. Hidden in Knitting Mode
 * so nothing covers the current row instructions.
 */
export default function QuickCreate() {
  const navigate = useNavigate();
  const { knittingMode } = useKnittingMode();
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<CreateType | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActiveType(null);
  }, []);

  // Global keyboard: `c` to open (when no input focused + not in knitting mode).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        close();
        return;
      }
      if (e.key.toLowerCase() !== 'c') return;
      if (knittingMode) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setOpen(true);
      setActiveType(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close, knittingMode]);

  if (knittingMode) return null;

  return (
    <>
      <button
        type="button"
        data-tour="quick-create"
        onClick={() => {
          setOpen(true);
          setActiveType(null);
        }}
        aria-label="Quick create (c)"
        title="Quick create (c)"
        className="fixed bottom-40 right-4 md:bottom-20 md:right-4 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900"
      >
        <FiPlus className="w-6 h-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-create-title"
        >
          <div
            className="bg-white dark:bg-gray-900 w-full sm:max-w-md shadow-xl rounded-t-xl sm:rounded-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h2
                  id="quick-create-title"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  Quick create
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {activeType
                    ? 'Just the essentials — you can fill in the rest later.'
                    : 'Pick what to create.'}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="ml-3 p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              {activeType === null && (
                <TypePicker onPick={setActiveType} />
              )}
              {activeType === 'project' && (
                <ProjectForm
                  onBack={() => setActiveType(null)}
                  onClose={close}
                  onCreated={(id) => navigate(`/projects/${id}`)}
                />
              )}
              {activeType === 'yarn' && (
                <YarnForm
                  onBack={() => setActiveType(null)}
                  onClose={close}
                  onCreated={(id) => navigate(`/yarn/${id}`)}
                />
              )}
              {activeType === 'pattern' && (
                <PatternForm
                  onBack={() => setActiveType(null)}
                  onClose={close}
                  onCreated={(id) => navigate(`/patterns/${id}`)}
                />
              )}
              {activeType === 'tool' && (
                <ToolForm
                  onBack={() => setActiveType(null)}
                  onClose={close}
                  onCreated={() => navigate('/tools')}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TypePicker({ onPick }: { onPick: (t: CreateType) => void }) {
  const options: Array<{
    type: CreateType;
    label: string;
    blurb: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      type: 'project',
      label: 'Project',
      blurb: 'Track a new knitting project',
      icon: <FiFolder className="w-6 h-6" />,
      color: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40',
    },
    {
      type: 'yarn',
      label: 'Yarn',
      blurb: 'Add a skein to your stash',
      icon: <FiPackage className="w-6 h-6" />,
      color: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40',
    },
    {
      type: 'pattern',
      label: 'Pattern',
      blurb: 'Save a new pattern',
      icon: <FiBook className="w-6 h-6" />,
      color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40',
    },
    {
      type: 'tool',
      label: 'Tool',
      blurb: 'Add a needle or hook',
      icon: <FiTool className="w-6 h-6" />,
      color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40',
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.type}
          type="button"
          onClick={() => onPick(o.type)}
          className="flex flex-col items-start gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-left"
        >
          <span
            className={`flex items-center justify-center w-10 h-10 rounded-md ${o.color}`}
          >
            {o.icon}
          </span>
          <span className="block">
            <span className="block font-semibold text-sm text-gray-900 dark:text-gray-100">
              {o.label}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {o.blurb}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ============================================================================
 * Minimal create forms — each shows only required + essential fields.
 * ==========================================================================*/

interface FormProps {
  onBack: () => void;
  onClose: () => void;
  onCreated: (id: string) => void;
}

function FooterButtons({
  onBack,
  onSave,
  saving,
  saveLabel = 'Create',
  saveDisabled = false,
}: {
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
  saveDisabled?: boolean;
}) {
  return (
    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 -mx-5 px-5">
      <button
        type="button"
        onClick={onBack}
        disabled={saving}
        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || saveDisabled}
        className="flex-[1.5] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}

function ProjectForm({ onBack, onClose, onCreated }: FormProps) {
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string>('planning');

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const project = await create.mutateAsync({ name: name.trim(), status });
      toast.success(`"${project.name}" created`);
      onClose();
      onCreated(project.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not create project');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project name
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunday cardigan"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="planning">Planning</option>
            <option value="in_progress">In progress</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          You can add pattern, yarn, and tools on the project page after this.
        </p>
      </div>
      <FooterButtons
        onBack={onBack}
        onSave={handleSave}
        saving={create.isPending}
        saveDisabled={!name.trim()}
      />
    </form>
  );
}

const YARN_WEIGHTS = [
  '',
  'Lace',
  'Fingering',
  'Sport',
  'DK',
  'Worsted',
  'Aran',
  'Bulky',
  'Super Bulky',
  'Jumbo',
];

function YarnForm({ onBack, onClose, onCreated }: FormProps) {
  const create = useCreateYarn();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [weight, setWeight] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const payload: Record<string, string> = { name: name.trim() };
      if (brand.trim()) payload.brand = brand.trim();
      if (color.trim()) payload.color = color.trim();
      if (weight) payload.weight = weight;
      const yarn = await create.mutateAsync(payload);
      toast.success(`"${yarn.name}" added`);
      onClose();
      onCreated(yarn.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not add yarn');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Yarn name
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wool of the Andes"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Brand
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Color
            </label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Weight
          </label>
          <select
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {YARN_WEIGHTS.map((w) => (
              <option key={w || 'none'} value={w}>
                {w || 'Optional…'}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Yardage, fibre, photos, and cost can be added on the yarn page after this.
        </p>
      </div>
      <FooterButtons
        onBack={onBack}
        onSave={handleSave}
        saving={create.isPending}
        saveDisabled={!name.trim()}
      />
    </form>
  );
}

function PatternForm({ onBack, onClose, onCreated }: FormProps) {
  const create = useCreatePattern();
  const [name, setName] = useState('');
  const [designer, setDesigner] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const payload: Record<string, string> = { name: name.trim() };
      if (designer.trim()) payload.designer = designer.trim();
      const pattern = await create.mutateAsync(payload);
      toast.success(`"${pattern.name}" added`);
      onClose();
      onCreated(pattern.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not add pattern');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pattern name
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Boxy Pullover"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Designer
          </label>
          <input
            type="text"
            value={designer}
            onChange={(e) => setDesigner(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Upload the PDF from the pattern page once it's created — you'll get
          complexity + text search automatically.
        </p>
      </div>
      <FooterButtons
        onBack={onBack}
        onSave={handleSave}
        saving={create.isPending}
        saveDisabled={!name.trim()}
      />
    </form>
  );
}

const TOOL_TYPES = [
  'Circular needle',
  'Double-pointed needle',
  'Straight needle',
  'Crochet hook',
  'Notion',
];

function ToolForm({ onBack, onClose, onCreated }: FormProps) {
  const create = useCreateTool();
  const [name, setName] = useState('');
  const [type, setType] = useState(TOOL_TYPES[0]);
  const [sizeMm, setSizeMm] = useState('');

  const autoName = () => {
    // Suggest "4mm circular" style name as a default.
    if (!name && type && sizeMm) {
      setName(`${sizeMm}mm ${type.toLowerCase()}`);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        type,
      };
      if (sizeMm) payload.sizeMm = parseFloat(sizeMm);
      const tool = await create.mutateAsync(payload);
      toast.success(`"${tool.name}" added`);
      onClose();
      onCreated(tool.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not add tool');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {TOOL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Size (mm)
          </label>
          <input
            type="number"
            step="0.25"
            min="0"
            value={sizeMm}
            onBlur={autoName}
            onChange={(e) => setSizeMm(e.target.value)}
            placeholder="e.g. 4.0"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={autoName}
            placeholder="Autofills from type + size"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Length, material, and brand can be added on the tools page after this.
        </p>
      </div>
      <FooterButtons
        onBack={onBack}
        onSave={handleSave}
        saving={create.isPending}
        saveDisabled={!name.trim()}
      />
    </form>
  );
}
