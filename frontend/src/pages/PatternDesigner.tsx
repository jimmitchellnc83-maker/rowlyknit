import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiTool, FiInfo, FiGrid, FiSquare, FiPrinter, FiFolder, FiBook } from 'react-icons/fi';
import { useCreatePattern, useCreateProject } from '../hooks/useApi';
import { itemLabel } from '../utils/designerSnapshot';
import {
  computeBlanket,
  computeBodyBlock,
  computeHat,
  computeMittens,
  computeScarf,
  computeShawl,
  computeSleeve,
  computeSocks,
  toInches,
  type BlanketInput,
  type BodyBlockInput,
  type HatInput,
  type MittenInput,
  type ScarfInput,
  type ShawlInput,
  type SleeveInput,
  type SockInput,
  type MeasurementUnit,
} from '../utils/designerMath';
import BodySchematic from '../components/designer/BodySchematic';
import ChartGrid, {
  emptyChart,
  resizeChart,
  type ChartData,
  type ChartTool,
} from '../components/designer/ChartGrid';
import ColorPalette, { type ColorSwatch } from '../components/designer/ColorPalette';
import ConfirmModal from '../components/ConfirmModal';
import HatSchematic from '../components/designer/HatSchematic';
import MittenSchematic from '../components/designer/MittenSchematic';
import RectSchematic from '../components/designer/RectSchematic';
import ShawlSchematic from '../components/designer/ShawlSchematic';
import SleeveSchematic from '../components/designer/SleeveSchematic';
import SockSchematic from '../components/designer/SockSchematic';
import StitchPalette from '../components/designer/StitchPalette';
import PageHelpButton from '../components/PageHelpButton';
import {
  DESIGNER_TEMPLATES,
  mergeTemplateIntoForm,
  type DesignerTemplate,
} from '../data/designerTemplates';
import CustomShapeEditor from '../components/designer/CustomShapeEditor';
import CustomSchematic from '../components/designer/CustomSchematic';
import { DEFAULT_CUSTOM_SHAPE, type CustomShape } from '../types/customShape';

type NumField = number | '';
type DesignerSection = 'body' | 'sleeve';
type ItemType = 'sweater' | 'hat' | 'scarf' | 'blanket' | 'shawl' | 'mittens' | 'socks' | 'custom';

interface ItemTypeOption {
  value: ItemType | string;
  label: string;
  disabled?: boolean;
}

// Catalog of item types. Supported types use the union above; roadmap
// entries stay as disabled strings so knitters can see what's coming
// without being able to select them.
const ITEM_TYPE_OPTIONS: ItemTypeOption[] = [
  { value: 'sweater', label: 'Sweater' },
  { value: 'hat', label: 'Hat' },
  { value: 'scarf', label: 'Scarf' },
  { value: 'blanket', label: 'Blanket' },
  { value: 'shawl', label: 'Shawl' },
  { value: 'mittens', label: 'Mittens' },
  { value: 'socks', label: 'Socks' },
  { value: 'custom', label: 'Custom shape' },
];

interface DesignerForm {
  // Shared
  unit: MeasurementUnit;
  gaugeStitches: NumField;
  gaugeRows: NumField;
  gaugeMeasurement: NumField;
  itemType: ItemType;
  activeSection: DesignerSection;

  // Hat
  headCircumference: NumField;
  negativeEaseAtBrim: NumField;
  hatTotalHeight: NumField;
  hatBrimDepth: NumField;
  hatCrownHeight: NumField;

  // Scarf
  scarfWidth: NumField;
  scarfLength: NumField;
  scarfFringeLength: NumField;

  // Blanket
  blanketWidth: NumField;
  blanketLength: NumField;
  blanketBorderDepth: NumField;

  // Shawl
  shawlWingspan: NumField;
  shawlInitialCastOn: NumField;

  // Mittens
  handCircumference: NumField;
  negativeEaseAtMittenCuff: NumField;
  thumbCircumference: NumField;
  mittenCuffDepth: NumField;
  cuffToThumbLength: NumField;
  thumbGussetLength: NumField;
  thumbToTipLength: NumField;
  thumbLength: NumField;

  // Socks
  ankleCircumference: NumField;
  negativeEaseAtSockCuff: NumField;
  footCircumference: NumField;
  sockCuffDepth: NumField;
  legLength: NumField;
  footLength: NumField;

  // Colors — optional palette the knitter plans to use. First color
  // becomes the main color; additional colors can be referenced by stripe /
  // colorwork extensions in later PRs.
  colors: ColorSwatch[];

  // Chart — optional stitch / colorwork grid attached to this design.
  // Null means "no chart yet"; when the user opens the Chart section the
  // first time we initialize a small default grid.
  chart: ChartData | null;

  // Body block
  chestCircumference: NumField;
  easeAtChest: NumField;
  totalLength: NumField;
  hemDepth: NumField;
  useWaistShaping: boolean;
  waistCircumference: NumField;
  easeAtWaist: NumField;
  waistHeightFromHem: NumField;
  /**
   * Set-in-sleeve armhole + matching sleeve cap. When enabled, the body
   * panel narrows for the armhole, and (separately) the sleeve grows a
   * matching cap above the bicep. Drop-shoulder construction leaves this off.
   */
  useArmhole: boolean;
  armholeDepth: NumField;
  shoulderWidth: NumField;
  /** 'front' renders neckline shaping; 'back' leaves a straight shoulder seam. */
  panelType: 'front' | 'back';
  necklineDepth: NumField;
  neckOpeningWidth: NumField;

  // Sleeve
  cuffCircumference: NumField;
  easeAtCuff: NumField;
  bicepCircumference: NumField;
  easeAtBicep: NumField;
  cuffToUnderarmLength: NumField;
  cuffDepth: NumField;

  // Custom shape — user-defined polygon. Always present in form state so
  // toggling to 'custom' itemType has something to show. Default vertices
  // form a 24×24 square that the user can then drag into any shape.
  custom: CustomShape;
}

const DEFAULT_FORM: DesignerForm = {
  unit: 'in',
  gaugeStitches: 20,
  gaugeRows: 28,
  gaugeMeasurement: 4,
  itemType: 'sweater',
  activeSection: 'body',

  headCircumference: 22,
  negativeEaseAtBrim: 1.5,
  hatTotalHeight: 9,
  hatBrimDepth: 2,
  hatCrownHeight: 2.5,

  scarfWidth: 8,
  scarfLength: 60,
  scarfFringeLength: 0,

  blanketWidth: 40,
  blanketLength: 50,
  blanketBorderDepth: 1.5,

  shawlWingspan: 60,
  shawlInitialCastOn: 7,

  handCircumference: 8,
  negativeEaseAtMittenCuff: 0.5,
  thumbCircumference: 3,
  mittenCuffDepth: 2,
  cuffToThumbLength: 1,
  thumbGussetLength: 1.5,
  thumbToTipLength: 3,
  thumbLength: 2,

  ankleCircumference: 8,
  negativeEaseAtSockCuff: 0.5,
  footCircumference: 9,
  sockCuffDepth: 1.5,
  legLength: 6,
  footLength: 8,

  chestCircumference: 36,
  easeAtChest: 4,
  totalLength: 24,
  hemDepth: 2,
  useWaistShaping: false,
  waistCircumference: 30,
  easeAtWaist: 2,
  waistHeightFromHem: 8,
  useArmhole: false,
  armholeDepth: 8,
  shoulderWidth: 5,
  panelType: 'back',
  necklineDepth: 2.5,
  neckOpeningWidth: 7,

  cuffCircumference: 7,
  easeAtCuff: 1,
  bicepCircumference: 12,
  easeAtBicep: 2,
  cuffToUnderarmLength: 18,
  cuffDepth: 2,

  colors: [],
  chart: null,

  custom: DEFAULT_CUSTOM_SHAPE,
};

const LS_KEY = 'rowly:designer:current';

function readSavedForm(): DesignerForm {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_FORM;
    const parsed = JSON.parse(raw) as Partial<DesignerForm>;
    return { ...DEFAULT_FORM, ...parsed };
  } catch {
    return DEFAULT_FORM;
  }
}

function isPositive(n: NumField): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isFiniteNum(n: NumField): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function gaugeReady(f: DesignerForm): boolean {
  return isPositive(f.gaugeStitches) && isPositive(f.gaugeRows) && isPositive(f.gaugeMeasurement);
}

function bodyReady(f: DesignerForm): boolean {
  if (!gaugeReady(f)) return false;
  if (
    !isPositive(f.chestCircumference) ||
    !isPositive(f.totalLength) ||
    !isPositive(f.hemDepth)
  )
    return false;
  if (!isFiniteNum(f.easeAtChest)) return false;
  if (f.useWaistShaping) {
    if (!isPositive(f.waistCircumference) || !isPositive(f.waistHeightFromHem)) return false;
    if (!isFiniteNum(f.easeAtWaist)) return false;
  }
  if (f.useArmhole) {
    if (!isPositive(f.armholeDepth) || !isPositive(f.shoulderWidth)) return false;
    if (f.panelType === 'front') {
      if (!isPositive(f.necklineDepth) || !isPositive(f.neckOpeningWidth)) return false;
    }
  }
  return true;
}

function hatReady(f: DesignerForm): boolean {
  if (!gaugeReady(f)) return false;
  if (
    !isPositive(f.headCircumference) ||
    !isPositive(f.hatTotalHeight) ||
    !isPositive(f.hatBrimDepth) ||
    !isPositive(f.hatCrownHeight)
  )
    return false;
  if (!isFiniteNum(f.negativeEaseAtBrim)) return false;
  return true;
}

function buildHatInput(f: DesignerForm): HatInput {
  return {
    gauge: normalizedGauge(f),
    headCircumference: toInches(f.headCircumference as number, f.unit),
    negativeEaseAtBrim: toInches(f.negativeEaseAtBrim as number, f.unit),
    totalHeight: toInches(f.hatTotalHeight as number, f.unit),
    brimDepth: toInches(f.hatBrimDepth as number, f.unit),
    crownHeight: toInches(f.hatCrownHeight as number, f.unit),
  };
}

function scarfReady(f: DesignerForm): boolean {
  if (!gaugeReady(f)) return false;
  if (!isPositive(f.scarfWidth) || !isPositive(f.scarfLength)) return false;
  if (!isFiniteNum(f.scarfFringeLength)) return false;
  return true;
}

function buildScarfInput(f: DesignerForm): ScarfInput {
  return {
    gauge: normalizedGauge(f),
    width: toInches(f.scarfWidth as number, f.unit),
    length: toInches(f.scarfLength as number, f.unit),
    fringeLength: toInches(f.scarfFringeLength as number, f.unit),
  };
}

function blanketReady(f: DesignerForm): boolean {
  if (!gaugeReady(f)) return false;
  if (!isPositive(f.blanketWidth) || !isPositive(f.blanketLength)) return false;
  if (!isFiniteNum(f.blanketBorderDepth)) return false;
  return true;
}

function buildBlanketInput(f: DesignerForm): BlanketInput {
  return {
    gauge: normalizedGauge(f),
    width: toInches(f.blanketWidth as number, f.unit),
    length: toInches(f.blanketLength as number, f.unit),
    borderDepth: toInches(f.blanketBorderDepth as number, f.unit),
  };
}

function shawlReady(f: DesignerForm): boolean {
  if (!gaugeReady(f)) return false;
  if (!isPositive(f.shawlWingspan) || !isPositive(f.shawlInitialCastOn)) return false;
  return true;
}

function buildShawlInput(f: DesignerForm): ShawlInput {
  return {
    gauge: normalizedGauge(f),
    wingspan: toInches(f.shawlWingspan as number, f.unit),
    initialCastOn: f.shawlInitialCastOn as number,
  };
}

function mittensReady(f: DesignerForm): boolean {
  if (!gaugeReady(f)) return false;
  if (
    !isPositive(f.handCircumference) ||
    !isPositive(f.thumbCircumference) ||
    !isPositive(f.mittenCuffDepth) ||
    !isPositive(f.cuffToThumbLength) ||
    !isPositive(f.thumbGussetLength) ||
    !isPositive(f.thumbToTipLength) ||
    !isPositive(f.thumbLength)
  )
    return false;
  if (!isFiniteNum(f.negativeEaseAtMittenCuff)) return false;
  return true;
}

function buildMittenInput(f: DesignerForm): MittenInput {
  return {
    gauge: normalizedGauge(f),
    handCircumference: toInches(f.handCircumference as number, f.unit),
    negativeEaseAtCuff: toInches(f.negativeEaseAtMittenCuff as number, f.unit),
    thumbCircumference: toInches(f.thumbCircumference as number, f.unit),
    cuffDepth: toInches(f.mittenCuffDepth as number, f.unit),
    cuffToThumbLength: toInches(f.cuffToThumbLength as number, f.unit),
    thumbGussetLength: toInches(f.thumbGussetLength as number, f.unit),
    thumbToTipLength: toInches(f.thumbToTipLength as number, f.unit),
    thumbLength: toInches(f.thumbLength as number, f.unit),
  };
}

function socksReady(f: DesignerForm): boolean {
  if (!gaugeReady(f)) return false;
  if (
    !isPositive(f.ankleCircumference) ||
    !isPositive(f.footCircumference) ||
    !isPositive(f.sockCuffDepth) ||
    !isPositive(f.legLength) ||
    !isPositive(f.footLength)
  )
    return false;
  if (!isFiniteNum(f.negativeEaseAtSockCuff)) return false;
  return true;
}

function buildSockInput(f: DesignerForm): SockInput {
  return {
    gauge: normalizedGauge(f),
    ankleCircumference: toInches(f.ankleCircumference as number, f.unit),
    negativeEaseAtCuff: toInches(f.negativeEaseAtSockCuff as number, f.unit),
    footCircumference: toInches(f.footCircumference as number, f.unit),
    cuffDepth: toInches(f.sockCuffDepth as number, f.unit),
    legLength: toInches(f.legLength as number, f.unit),
    footLength: toInches(f.footLength as number, f.unit),
  };
}

function sleeveReady(f: DesignerForm): boolean {
  if (!gaugeReady(f)) return false;
  if (
    !isPositive(f.cuffCircumference) ||
    !isPositive(f.bicepCircumference) ||
    !isPositive(f.cuffToUnderarmLength) ||
    !isPositive(f.cuffDepth)
  )
    return false;
  if (!isFiniteNum(f.easeAtCuff) || !isFiniteNum(f.easeAtBicep)) return false;
  return true;
}

function normalizedGauge(f: DesignerForm) {
  const measurementIn = toInches(f.gaugeMeasurement as number, f.unit);
  return {
    stitchesPer4in: ((f.gaugeStitches as number) / measurementIn) * 4,
    rowsPer4in: ((f.gaugeRows as number) / measurementIn) * 4,
  };
}

function buildBodyInput(f: DesignerForm): BodyBlockInput {
  return {
    gauge: normalizedGauge(f),
    chestCircumference: toInches(f.chestCircumference as number, f.unit),
    easeAtChest: toInches(f.easeAtChest as number, f.unit),
    totalLength: toInches(f.totalLength as number, f.unit),
    hemDepth: toInches(f.hemDepth as number, f.unit),
    waist: f.useWaistShaping
      ? {
          waistCircumference: toInches(f.waistCircumference as number, f.unit),
          easeAtWaist: toInches(f.easeAtWaist as number, f.unit),
          waistHeightFromHem: toInches(f.waistHeightFromHem as number, f.unit),
        }
      : undefined,
    armhole: f.useArmhole
      ? {
          armholeDepth: toInches(f.armholeDepth as number, f.unit),
          shoulderWidth: toInches(f.shoulderWidth as number, f.unit),
        }
      : undefined,
    neckline:
      f.useArmhole && f.panelType === 'front'
        ? {
            necklineDepth: toInches(f.necklineDepth as number, f.unit),
            neckOpeningWidth: toInches(f.neckOpeningWidth as number, f.unit),
          }
        : undefined,
  };
}

/**
 * Build the sleeve input, optionally pulling the cap config from the body's
 * armhole so the underarm seams and depths line up. Users don't see a separate
 * "cap" toggle — enabling body armhole automatically grows a matching cap.
 */
function buildSleeveInput(f: DesignerForm, bodyArmholeInitialBindOff: number | null): SleeveInput {
  return {
    gauge: normalizedGauge(f),
    cuffCircumference: toInches(f.cuffCircumference as number, f.unit),
    easeAtCuff: toInches(f.easeAtCuff as number, f.unit),
    bicepCircumference: toInches(f.bicepCircumference as number, f.unit),
    easeAtBicep: toInches(f.easeAtBicep as number, f.unit),
    cuffToUnderarmLength: toInches(f.cuffToUnderarmLength as number, f.unit),
    cuffDepth: toInches(f.cuffDepth as number, f.unit),
    cap:
      f.useArmhole && bodyArmholeInitialBindOff !== null
        ? {
            matchingArmholeDepth: toInches(f.armholeDepth as number, f.unit),
            matchingArmholeInitialBindOff: bodyArmholeInitialBindOff,
          }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  suffix,
}: {
  label: string;
  value: NumField;
  onChange: (v: NumField) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {suffix ? <span className="ml-1 text-xs text-gray-400">({suffix})</span> : null}
      </span>
      <input
        type="number"
        value={value === '' ? '' : String(value)}
        step={step}
        min={min}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') return onChange('');
          const parsed = parseFloat(v);
          onChange(Number.isFinite(parsed) ? parsed : '');
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
    </label>
  );
}

function StepCard({
  step,
}: {
  step: { label: string; startStitches: number; endStitches: number; rows: number; instruction: string };
}) {
  const stitchSummary =
    step.startStitches === 0
      ? `${step.endStitches} sts`
      : step.endStitches === 0
        ? `${step.startStitches} sts`
        : `${step.startStitches} → ${step.endStitches} sts`;

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{step.label}</h3>
        <span className="text-xs text-gray-500">
          {stitchSummary}
          {step.rows > 1 && <> · {step.rows} rows</>}
        </span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">{step.instruction}</p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Chart section — optional stitch/colorwork grid attached to any design.
// Width/height are editable as numbers; resizing preserves the overlapping
// area. The StitchPalette feeds an active tool (symbol / palette color /
// erase) that ChartGrid applies on click and drag.
// ---------------------------------------------------------------------------

/**
 * Creates a new project with the current design snapshotted into
 * `metadata.designer`. After creation, navigates to the new project's
 * detail page where the design renders inline (see ProjectDetail.tsx).
 *
 * The form is captured as-is — users can edit the design in the Designer
 * afterwards, and either overwrite the project's snapshot (future PR) or
 * leave the project frozen as a point-in-time reference. v1: frozen.
 */
function SaveToProjectButton({ form }: { form: DesignerForm }) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const label = itemLabel(form.itemType);

  const save = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const project = await createProject.mutateAsync({
        name: `${label} — ${today}`,
        projectType: form.itemType === 'sweater' ? 'sweater' : 'other',
        notes: `Designed in the Pattern Designer on ${today}.`,
        metadata: {
          designer: form,
          designer_snapshot_at: new Date().toISOString(),
        },
      });
      toast.success(`Project "${project.name}" created with this design.`);
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save as project');
    }
  };

  return (
    <button
      type="button"
      onClick={save}
      disabled={createProject.isPending}
      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-70"
      title="Create a new project with this design attached"
    >
      <FiFolder className="h-4 w-4" />
      {createProject.isPending ? 'Saving…' : 'Save as project'}
    </button>
  );
}

/**
 * Save the current design as a pattern in the user's library. The pattern
 * carries the Designer snapshot in `metadata.designer`, plus the item type
 * as the name and basic gauge text in the `gauge` field so it shows up in
 * pattern searches correctly.
 *
 * Differs from SaveToProjectButton in that a *pattern* is a reusable
 * template — the user can start multiple projects from the same pattern
 * later. A project is a single knitted item.
 */
function SaveAsPatternButton({ form }: { form: DesignerForm }) {
  const navigate = useNavigate();
  const createPattern = useCreatePattern();
  const label = itemLabel(form.itemType);

  const save = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const gaugeText =
        form.gaugeStitches && form.gaugeRows && form.gaugeMeasurement
          ? `${form.gaugeStitches} sts × ${form.gaugeRows} rows over ${form.gaugeMeasurement} ${form.unit}`
          : undefined;
      const pattern = await createPattern.mutateAsync({
        name: `${label} — ${today}`,
        designer: 'Me (via Designer)',
        category: form.itemType,
        gauge: gaugeText,
        notes: `Created in the Pattern Designer on ${today}.`,
        metadata: {
          designer: form,
          designer_snapshot_at: new Date().toISOString(),
        },
      });
      toast.success(`Pattern "${pattern.name}" saved to library.`);
      navigate(`/patterns/${pattern.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save as pattern');
    }
  };

  return (
    <button
      type="button"
      onClick={save}
      disabled={createPattern.isPending}
      className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-70 dark:border-purple-800 dark:bg-gray-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
      title="Save this design as a reusable pattern in your library"
    >
      <FiBook className="h-4 w-4" />
      {createPattern.isPending ? 'Saving…' : 'Save as pattern'}
    </button>
  );
}

function ChartSection({
  chart,
  onChange,
  paletteColors,
}: {
  chart: ChartData | null;
  onChange: (next: ChartData | null) => void;
  paletteColors: ColorSwatch[];
}) {
  const [tool, setTool] = useState<ChartTool>({ type: 'symbol', symbolId: 'knit' });
  const [cellSize, setCellSize] = useState<number>(28);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  if (!chart) {
    return (
      <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Chart <span className="text-xs font-normal text-gray-500">(optional)</span>
        </h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Design a stitch or colorwork chart to attach to this pattern. Click or drag on the grid
          to place symbols (knit, purl, yarn-over, decreases) or colors from the palette. The
          chart rides along with the rest of the design in the print view.
        </p>
        <button
          type="button"
          onClick={() => onChange(emptyChart(20, 16))}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          Add chart
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chart</h2>
        <div className="flex items-center gap-4">
          {/* Zoom toggle — compact, medium, large. Gives knitters a way to
              scale the grid based on how much detail they're placing. */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Zoom</span>
            {[
              { label: 'S', px: 22 },
              { label: 'M', px: 28 },
              { label: 'L', px: 36 },
              { label: 'XL', px: 48 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setCellSize(opt.px)}
                aria-pressed={cellSize === opt.px}
                className={`rounded border px-2 py-0.5 text-xs ${
                  cellSize === opt.px
                    ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-purple-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowRemoveConfirm(true)}
            className="text-xs text-red-600 hover:underline"
          >
            Remove chart
          </button>
        </div>
      </div>

      {showRemoveConfirm && (
        <ConfirmModal
          title="Remove chart"
          message="Remove the chart entirely? This clears the grid."
          confirmLabel="Remove"
          onConfirm={() => {
            setShowRemoveConfirm(false);
            onChange(null);
          }}
          onCancel={() => setShowRemoveConfirm(false)}
        />
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Width (stitches)
          </span>
          <input
            type="number"
            min={1}
            max={60}
            value={chart.width}
            onChange={(e) => {
              const w = parseInt(e.target.value || '0', 10);
              if (Number.isFinite(w) && w > 0 && w <= 60) {
                onChange(resizeChart(chart, w, chart.height));
              }
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Height (rows)
          </span>
          <input
            type="number"
            min={1}
            max={60}
            value={chart.height}
            onChange={(e) => {
              const h = parseInt(e.target.value || '0', 10);
              if (Number.isFinite(h) && h > 0 && h <= 60) {
                onChange(resizeChart(chart, chart.width, h));
              }
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </label>
      </div>

      <StitchPalette tool={tool} onChange={setTool} paletteColors={paletteColors} />

      <div className="mt-4">
        <ChartGrid chart={chart} onChange={onChange} tool={tool} cellSize={cellSize} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(emptyChart(chart.width, chart.height))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Clear all cells
        </button>
        <span className="text-xs text-gray-500">
          Max 60×60. Row 1 (bottom, RS) is the first row you knit.
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function PatternDesigner() {
  const [form, setForm] = useState<DesignerForm>(() => readSavedForm());

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(form));
    } catch {
      /* storage unavailable */
    }
  }, [form]);

  const bodyOutput = useMemo(() => {
    if (!bodyReady(form)) return null;
    try {
      return computeBodyBlock(buildBodyInput(form));
    } catch (e) {
      console.error('[Designer] body compute error:', e);
      return null;
    }
  }, [form]);

  const sleeveOutput = useMemo(() => {
    if (!sleeveReady(form)) return null;
    try {
      // Cap auto-matches the body's armhole so the seam lines up. When the
      // body has no armhole shaping, pass null and the sleeve renders
      // drop-shoulder style (straight underarm bind-off).
      const bodyInitialBindOff = bodyOutput?.armholeInitialBindOffPerSide ?? null;
      return computeSleeve(buildSleeveInput(form, bodyInitialBindOff));
    } catch (e) {
      console.error('[Designer] sleeve compute error:', e);
      return null;
    }
  }, [form, bodyOutput]);

  const hatOutput = useMemo(() => {
    if (!hatReady(form)) return null;
    try {
      return computeHat(buildHatInput(form));
    } catch (e) {
      console.error('[Designer] hat compute error:', e);
      return null;
    }
  }, [form]);

  const scarfOutput = useMemo(() => {
    if (!scarfReady(form)) return null;
    try {
      return computeScarf(buildScarfInput(form));
    } catch (e) {
      console.error('[Designer] scarf compute error:', e);
      return null;
    }
  }, [form]);

  const blanketOutput = useMemo(() => {
    if (!blanketReady(form)) return null;
    try {
      return computeBlanket(buildBlanketInput(form));
    } catch (e) {
      console.error('[Designer] blanket compute error:', e);
      return null;
    }
  }, [form]);

  const shawlOutput = useMemo(() => {
    if (!shawlReady(form)) return null;
    try {
      return computeShawl(buildShawlInput(form));
    } catch (e) {
      console.error('[Designer] shawl compute error:', e);
      return null;
    }
  }, [form]);

  const mittenOutput = useMemo(() => {
    if (!mittensReady(form)) return null;
    try {
      return computeMittens(buildMittenInput(form));
    } catch (e) {
      console.error('[Designer] mittens compute error:', e);
      return null;
    }
  }, [form]);

  const sockOutput = useMemo(() => {
    if (!socksReady(form)) return null;
    try {
      return computeSocks(buildSockInput(form));
    } catch (e) {
      console.error('[Designer] socks compute error:', e);
      return null;
    }
  }, [form]);

  const update = <K extends keyof DesignerForm>(key: K, value: DesignerForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const unitLabel = form.unit === 'in' ? 'in' : 'cm';

  const applyTemplate = (template: DesignerTemplate) => {
    setForm((prev) => mergeTemplateIntoForm(template, prev));
    toast.success(`Applied template: ${template.name}`);
  };

  const visibleTemplates = DESIGNER_TEMPLATES.filter((t) => t.itemType === form.itemType);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FiTool className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
            Pattern Designer
          </h1>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-purple-700">
            Beta
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SaveAsPatternButton form={form} />
            <SaveToProjectButton form={form} />
            <Link
              to="/designer/print"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-purple-300 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
              title="Open a printable pattern write-up in a new tab"
            >
              <FiPrinter className="h-4 w-4" />
              Print pattern
            </Link>
            <PageHelpButton label="Designer help" />
          </div>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
          Draft garments from body measurements and your swatch gauge. Supports sweater, hat,
          scarf, blanket, shawl, mittens, and socks. Click <strong>Print pattern</strong> to open a
          clean write-up with schematics and step-by-step instructions, ready to print or save as
          PDF. Drafts are saved locally to this browser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-5">
        {/* Inputs — always show shared Units + Gauge; switch Body/Sleeve inputs below */}
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Units</h2>
            <div className="flex gap-2">
              {(['in', 'cm'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => update('unit', u)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.unit === u
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {u === 'in' ? 'Inches' : 'Centimeters'}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Gauge <span className="text-xs font-normal text-gray-500">(shared across sections)</span>
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Stitches"
                value={form.gaugeStitches}
                onChange={(v) => update('gaugeStitches', v)}
              />
              <NumberInput
                label="Rows"
                value={form.gaugeRows}
                onChange={(v) => update('gaugeRows', v)}
              />
            </div>
            <div className="mt-3">
              <NumberInput
                label="Over"
                value={form.gaugeMeasurement}
                onChange={(v) => update('gaugeMeasurement', v)}
                step={0.5}
                suffix={unitLabel}
              />
            </div>
          </section>

          {/* Item type selector — dropdown so the roadmap (scarf, mittens,
              socks, shawl, blanket, …) can keep expanding without crowding
              the page. Coming-soon entries stay in the list as disabled
              options so the catalog is visible at a glance. */}
          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Item type
              </span>
              <select
                value={form.itemType}
                onChange={(e) => update('itemType', e.target.value as ItemType)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                aria-label="Item type"
              >
                {ITEM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* Quick-start templates — clicking a chip replaces the
              measurement fields for the current itemType. Gauge, colors,
              and the chart are preserved so the knitter doesn't lose
              setup work. Values are stored in inches in the catalog and
              converted on apply when the user is in cm mode. */}
          {visibleTemplates.length > 0 && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <h2 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Quick start
              </h2>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Pick a starting point — measurements load into the form below and you can adjust from there.
              </p>
              <div className="flex flex-wrap gap-2">
                {visibleTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="group rounded-lg border border-purple-200 bg-purple-50/40 px-3 py-2 text-left transition hover:border-purple-400 hover:bg-purple-50 dark:border-purple-900/40 dark:bg-purple-900/10 dark:hover:border-purple-600 dark:hover:bg-purple-900/30"
                    title={`Apply: ${t.name}`}
                  >
                    <div className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      {t.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {t.description}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Color palette — shared across all item types. First color
              becomes MC and is shown alongside the schematic as a preview. */}
          <ColorPalette colors={form.colors} onChange={(next) => update('colors', next)} />

          {form.itemType === 'sweater' && (
            <>
          {/* Section tabs */}
          <section className="rounded-lg bg-white p-2 shadow dark:bg-gray-800">
            <div className="flex gap-1" role="tablist" aria-label="Garment section">
              <button
                role="tab"
                aria-selected={form.activeSection === 'body'}
                onClick={() => update('activeSection', 'body')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  form.activeSection === 'body'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <FiSquare className="h-4 w-4" />
                Body
              </button>
              <button
                role="tab"
                aria-selected={form.activeSection === 'sleeve'}
                onClick={() => update('activeSection', 'sleeve')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  form.activeSection === 'sleeve'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <FiGrid className="h-4 w-4" />
                Sleeve
              </button>
            </div>
          </section>

          {form.activeSection === 'body' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Body block
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Chest / bust circumference"
                  value={form.chestCircumference}
                  onChange={(v) => update('chestCircumference', v)}
                  step={0.5}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Ease at chest"
                  value={form.easeAtChest}
                  onChange={(v) => update('easeAtChest', v)}
                  step={0.5}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Total length"
                  value={form.totalLength}
                  onChange={(v) => update('totalLength', v)}
                  step={0.5}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Hem depth"
                  value={form.hemDepth}
                  onChange={(v) => update('hemDepth', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
              </div>

              <label className="mt-4 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.useWaistShaping}
                  onChange={(e) => update('useWaistShaping', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Add waist shaping
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Narrows the body to the waist circumference, then increases back out to the
                    bust.
                  </span>
                </span>
              </label>

              {form.useWaistShaping && (
                <div className="mt-4 space-y-3 rounded-lg border border-purple-100 bg-purple-50/50 p-3 dark:border-purple-900/30 dark:bg-purple-900/10">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                      label="Waist circumference"
                      value={form.waistCircumference}
                      onChange={(v) => update('waistCircumference', v)}
                      step={0.5}
                      suffix={unitLabel}
                    />
                    <NumberInput
                      label="Ease at waist"
                      value={form.easeAtWaist}
                      onChange={(v) => update('easeAtWaist', v)}
                      step={0.5}
                      suffix={unitLabel}
                    />
                  </div>
                  <NumberInput
                    label="Height from cast-on to waist"
                    value={form.waistHeightFromHem}
                    onChange={(v) => update('waistHeightFromHem', v)}
                    step={0.5}
                    suffix={unitLabel}
                  />
                </div>
              )}

              <label className="mt-4 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.useArmhole}
                  onChange={(e) => update('useArmhole', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Set-in sleeve armhole
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Narrows the top of the body for a fitted armhole, and grows a matching cap on the
                    sleeve. Leave off for drop-shoulder construction.
                  </span>
                </span>
              </label>

              {form.useArmhole && (
                <div className="mt-4 space-y-3 rounded-lg border border-purple-100 bg-purple-50/50 p-3 dark:border-purple-900/30 dark:bg-purple-900/10">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                      label="Armhole depth"
                      value={form.armholeDepth}
                      onChange={(v) => update('armholeDepth', v)}
                      step={0.5}
                      suffix={unitLabel}
                    />
                    <NumberInput
                      label="Shoulder width (each)"
                      value={form.shoulderWidth}
                      onChange={(v) => update('shoulderWidth', v)}
                      step={0.25}
                      suffix={unitLabel}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Panel
                    </label>
                    <div className="flex gap-2">
                      {(['back', 'front'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => update('panelType', p)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            form.panelType === p
                              ? 'border-purple-600 bg-purple-600 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {p === 'back' ? 'Back (no neckline)' : 'Front (with neckline)'}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Design each panel separately. Switch to "Front" to add neckline shaping.
                    </p>
                  </div>

                  {form.panelType === 'front' && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <NumberInput
                        label="Neckline depth"
                        value={form.necklineDepth}
                        onChange={(v) => update('necklineDepth', v)}
                        step={0.25}
                        suffix={unitLabel}
                      />
                      <NumberInput
                        label="Neck opening width"
                        value={form.neckOpeningWidth}
                        onChange={(v) => update('neckOpeningWidth', v)}
                        step={0.25}
                        suffix={unitLabel}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {form.activeSection === 'sleeve' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Sleeve
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Cuff / wrist circumference"
                  value={form.cuffCircumference}
                  onChange={(v) => update('cuffCircumference', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Ease at cuff"
                  value={form.easeAtCuff}
                  onChange={(v) => update('easeAtCuff', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Bicep circumference"
                  value={form.bicepCircumference}
                  onChange={(v) => update('bicepCircumference', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Ease at bicep"
                  value={form.easeAtBicep}
                  onChange={(v) => update('easeAtBicep', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Cuff to underarm"
                  value={form.cuffToUnderarmLength}
                  onChange={(v) => update('cuffToUnderarmLength', v)}
                  step={0.5}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Cuff depth"
                  value={form.cuffDepth}
                  onChange={(v) => update('cuffDepth', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Enable "Set-in sleeve armhole" on the Body tab to grow a matching cap here
                automatically.
              </p>
            </section>
          )}
            </>
          )}

          {form.itemType === 'hat' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Hat</h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Head circumference"
                  value={form.headCircumference}
                  onChange={(v) => update('headCircumference', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Negative ease at brim"
                  value={form.negativeEaseAtBrim}
                  onChange={(v) => update('negativeEaseAtBrim', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Total height"
                  value={form.hatTotalHeight}
                  onChange={(v) => update('hatTotalHeight', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Brim depth"
                  value={form.hatBrimDepth}
                  onChange={(v) => update('hatBrimDepth', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Crown shaping height"
                  value={form.hatCrownHeight}
                  onChange={(v) => update('hatCrownHeight', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Designed to work in the round. Negative ease (typically 1–2 in) gives a snug fit
                since ribbed fabric stretches. Crown shaping guidance is general — 8 decrease
                points spaced equally around is the common cadence.
              </p>
            </section>
          )}

          {form.itemType === 'scarf' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Scarf</h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Width"
                  value={form.scarfWidth}
                  onChange={(v) => update('scarfWidth', v)}
                  step={0.5}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Length"
                  value={form.scarfLength}
                  onChange={(v) => update('scarfLength', v)}
                  step={1}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Fringe length per side"
                  value={form.scarfFringeLength}
                  onChange={(v) => update('scarfFringeLength', v)}
                  step={0.5}
                  suffix={unitLabel}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Set fringe to 0 to skip it. Scarves look best in reversible stitches (garter, ribbed,
                or double-knit) so the back doesn't look messy when the scarf twists.
              </p>
            </section>
          )}

          {form.itemType === 'shawl' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Shawl</h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Wingspan"
                  value={form.shawlWingspan}
                  onChange={(v) => update('shawlWingspan', v)}
                  step={1}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Initial cast-on (after garter tab)"
                  value={form.shawlInitialCastOn}
                  onChange={(v) => update('shawlInitialCastOn', v)}
                  step={1}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Top-down triangular shawl worked from the center-back neck out. Depth comes out to
                roughly wingspan ÷ 4 at your gauge. For a deeper shawl, choose a wider wingspan
                and add a lace/garter border along the bottom edge.
              </p>
            </section>
          )}

          {form.itemType === 'mittens' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Mittens</h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Hand circumference" value={form.handCircumference} onChange={(v) => update('handCircumference', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Negative ease at cuff" value={form.negativeEaseAtMittenCuff} onChange={(v) => update('negativeEaseAtMittenCuff', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Thumb circumference" value={form.thumbCircumference} onChange={(v) => update('thumbCircumference', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Cuff depth" value={form.mittenCuffDepth} onChange={(v) => update('mittenCuffDepth', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Cuff → thumb length" value={form.cuffToThumbLength} onChange={(v) => update('cuffToThumbLength', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Thumb gusset length" value={form.thumbGussetLength} onChange={(v) => update('thumbGussetLength', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Thumb → tip length" value={form.thumbToTipLength} onChange={(v) => update('thumbToTipLength', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Thumb length" value={form.thumbLength} onChange={(v) => update('thumbLength', v)} step={0.25} suffix={unitLabel} />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Bottom-up, worked in the round. Afterthought-style thumb: increase a gusset at
                the palm seam, transfer stitches to a holder, continue hand, then pick up and
                work the thumb separately.
              </p>
            </section>
          )}

          {form.itemType === 'socks' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Socks</h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Ankle circumference" value={form.ankleCircumference} onChange={(v) => update('ankleCircumference', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Negative ease at cuff" value={form.negativeEaseAtSockCuff} onChange={(v) => update('negativeEaseAtSockCuff', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Foot circumference" value={form.footCircumference} onChange={(v) => update('footCircumference', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Cuff depth" value={form.sockCuffDepth} onChange={(v) => update('sockCuffDepth', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Leg length" value={form.legLength} onChange={(v) => update('legLength', v)} step={0.25} suffix={unitLabel} />
                <NumberInput label="Foot length" value={form.footLength} onChange={(v) => update('footLength', v)} step={0.25} suffix={unitLabel} />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Top-down with a classic heel-flap + heel-turn + gusset + grafted toe. Cast-on is
                rounded to a multiple of 4 for clean ribbing and a clean heel split.
              </p>
            </section>
          )}

          {form.itemType === 'blanket' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Blanket</h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Width"
                  value={form.blanketWidth}
                  onChange={(v) => update('blanketWidth', v)}
                  step={1}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Length"
                  value={form.blanketLength}
                  onChange={(v) => update('blanketLength', v)}
                  step={1}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Border depth"
                  value={form.blanketBorderDepth}
                  onChange={(v) => update('blanketBorderDepth', v)}
                  step={0.25}
                  suffix={unitLabel}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                A border in garter or seed stitch keeps the edges from curling. Set border depth to 0
                to skip. Typical baby blanket: 30×36 in; throw: 48×60 in; twin: 66×90 in.
              </p>
            </section>
          )}

          {form.itemType === 'custom' && (
            <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Custom shape
              </h2>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <NumberInput
                  label="Width"
                  value={form.custom.widthInches}
                  onChange={(v) =>
                    update('custom', {
                      ...form.custom,
                      widthInches: typeof v === 'number' ? v : form.custom.widthInches,
                    })
                  }
                  step={0.5}
                  suffix={unitLabel}
                />
                <NumberInput
                  label="Height"
                  value={form.custom.heightInches}
                  onChange={(v) =>
                    update('custom', {
                      ...form.custom,
                      heightInches: typeof v === 'number' ? v : form.custom.heightInches,
                    })
                  }
                  step={0.5}
                  suffix={unitLabel}
                />
              </div>
              <CustomShapeEditor
                shape={form.custom}
                onChange={(next) => update('custom', next)}
              />
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Build any silhouette by dragging the corners. Click between two dots to add a vertex.
                The pattern chart (if you've set one) tiles across the shape and clips to its outline.
              </p>
            </section>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Schematic —{' '}
              {form.itemType === 'hat'
                ? 'Hat'
                : form.itemType === 'scarf'
                  ? 'Scarf'
                  : form.itemType === 'blanket'
                    ? 'Blanket'
                    : form.itemType === 'shawl'
                      ? 'Shawl'
                      : form.itemType === 'mittens'
                        ? 'Mittens'
                        : form.itemType === 'socks'
                          ? 'Socks'
                          : form.itemType === 'custom'
                            ? 'Custom shape'
                            : form.activeSection === 'body'
                              ? 'Body block'
                              : 'Sleeve'}
            </h2>
            {form.itemType === 'hat' && hatOutput ? (
              <HatSchematic output={hatOutput} unit={form.unit} chart={form.chart} />
            ) : form.itemType === 'mittens' && mittenOutput ? (
              <MittenSchematic output={mittenOutput} unit={form.unit} />
            ) : form.itemType === 'socks' && sockOutput ? (
              <SockSchematic output={sockOutput} unit={form.unit} />
            ) : form.itemType === 'shawl' && shawlOutput ? (
              <ShawlSchematic output={shawlOutput} unit={form.unit} />
            ) : form.itemType === 'scarf' && scarfOutput ? (
              <RectSchematic
                label="Scarf"
                accent="purple"
                widthInches={scarfOutput.finishedWidth}
                lengthInches={scarfOutput.finishedLength}
                castOnStitches={scarfOutput.castOnStitches}
                fringeInches={scarfOutput.fringeLength}
                unit={form.unit}
                chart={form.chart}
              />
            ) : form.itemType === 'blanket' && blanketOutput ? (
              <RectSchematic
                label="Blanket"
                accent="green"
                widthInches={blanketOutput.finishedWidth}
                lengthInches={blanketOutput.finishedLength}
                castOnStitches={blanketOutput.castOnStitches}
                borderInches={
                  typeof form.blanketBorderDepth === 'number' ? form.blanketBorderDepth : 0
                }
                unit={form.unit}
                chart={form.chart}
              />
            ) : form.itemType === 'sweater' && form.activeSection === 'body' && bodyOutput ? (
              <BodySchematic input={buildBodyInput(form)} output={bodyOutput} unit={form.unit} chart={form.chart} />
            ) : form.itemType === 'sweater' && form.activeSection === 'sleeve' && sleeveOutput ? (
              <SleeveSchematic
                input={buildSleeveInput(form, bodyOutput?.armholeInitialBindOffPerSide ?? null)}
                output={sleeveOutput}
                unit={form.unit}
                chart={form.chart}
              />
            ) : form.itemType === 'custom' ? (
              <CustomSchematic
                shape={form.custom}
                unit={form.unit}
                chart={form.chart}
                stitchesPerInch={
                  gaugeReady(form) ? normalizedGauge(form).stitchesPer4in / 4 : undefined
                }
                rowsPerInch={
                  gaugeReady(form) ? normalizedGauge(form).rowsPer4in / 4 : undefined
                }
              />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
                Fill in gauge and section measurements to see the schematic.
              </div>
            )}

            {/* Color palette preview — echo of the Colors card inputs, shown
                alongside the schematic so knitters can eyeball the palette
                in context. */}
            {form.colors.length > 0 && (
              <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Palette
                </p>
                <div className="flex flex-wrap gap-2">
                  {form.colors.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 dark:bg-gray-900/50">
                      <span
                        className="h-5 w-5 rounded-full border border-gray-300"
                        style={{ backgroundColor: c.hex }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {i === 0 ? 'MC · ' : ''}{c.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Shaping schedule
            </h2>
            {form.itemType === 'hat' && hatOutput ? (
              <div className="space-y-3">
                {hatOutput.steps.map((step, i) => (
                  <StepCard key={`hat-${i}`} step={step} />
                ))}
              </div>
            ) : form.itemType === 'mittens' && mittenOutput ? (
              <div className="space-y-3">
                {mittenOutput.steps.map((step, i) => (
                  <StepCard key={`mitten-${i}`} step={step} />
                ))}
              </div>
            ) : form.itemType === 'socks' && sockOutput ? (
              <div className="space-y-3">
                {sockOutput.steps.map((step, i) => (
                  <StepCard key={`sock-${i}`} step={step} />
                ))}
              </div>
            ) : form.itemType === 'shawl' && shawlOutput ? (
              <div className="space-y-3">
                {shawlOutput.steps.map((step, i) => (
                  <StepCard key={`shawl-${i}`} step={step} />
                ))}
              </div>
            ) : form.itemType === 'scarf' && scarfOutput ? (
              <div className="space-y-3">
                {scarfOutput.steps.map((step, i) => (
                  <StepCard key={`scarf-${i}`} step={step} />
                ))}
              </div>
            ) : form.itemType === 'blanket' && blanketOutput ? (
              <div className="space-y-3">
                {blanketOutput.steps.map((step, i) => (
                  <StepCard key={`blanket-${i}`} step={step} />
                ))}
              </div>
            ) : form.itemType === 'sweater' && form.activeSection === 'body' && bodyOutput ? (
              <div className="space-y-3">
                {bodyOutput.steps.map((step, i) => (
                  <StepCard key={`body-${i}`} step={step} />
                ))}
              </div>
            ) : form.itemType === 'sweater' && form.activeSection === 'sleeve' && sleeveOutput ? (
              <div className="space-y-3">
                {sleeveOutput.steps.map((step, i) => (
                  <StepCard key={`sleeve-${i}`} step={step} />
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-gray-500">No output yet.</p>
            )}
          </section>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-200">
            <FiInfo className="mr-1 inline h-3 w-3" />
            Supported item types: sweater, hat, scarf, blanket, shawl, mittens, socks. Full
            catalog shipped — next up: coloring, stitch-grid authoring, production card deck,
            DB persistence, PDF export.
          </div>
        </div>
      </div>

      {/* Chart — full-width row below the form+preview grid so the grid
          canvas gets the whole page width, not just the narrow form column.
          Supports charts up to 60×60 cells (~1700px wide at 28px cells).
          Horizontal scroll inside the section handles anything wider than
          the viewport. */}
      <ChartSection
        chart={form.chart}
        onChange={(next) => update('chart', next)}
        paletteColors={form.colors}
      />
    </div>
  );
}
