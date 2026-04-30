import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiTool, FiInfo, FiGrid, FiSquare, FiPrinter, FiFolder, FiBook, FiFilePlus, FiSave } from 'react-icons/fi';
import type { Craft } from '../types/chartSymbol';
import { useCreatePattern, useUpdatePattern, useCreateProject } from '../hooks/useApi';
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
import ChartLegend from '../components/designer/ChartLegend';
import YardageEstimateWidget from '../components/designer/YardageEstimateWidget';
import PageHelpButton from '../components/PageHelpButton';
import { useChartSymbols } from '../hooks/useChartSymbols';
import { buildChartInstructions } from '../utils/chartInstruction';
import { SaveChartModal, LoadChartModal } from '../components/designer/ChartAssetModals';
import axios from 'axios';
import {
  DESIGNER_TEMPLATES,
  mergeTemplateIntoForm,
  type DesignerTemplate,
} from '../data/designerTemplates';
import CustomDraftEditor from '../components/designer/CustomDraftEditor';
import CustomDraftSchematic from '../components/designer/CustomDraftSchematic';
import { computeCustomDraft } from '../utils/designerMath';
import { DEFAULT_CUSTOM_DRAFT, type CustomDraft } from '../types/customDraft';
import { useMeasurementPrefs } from '../hooks/useMeasurementPrefs';

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
  { value: 'custom', label: 'Custom shape (section-based)' },
];

interface DesignerForm {
  // Shared
  unit: MeasurementUnit;
  /** Active craft. Drives the stitch palette + future construction math. */
  craft: Craft;
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

  // When the user has Saved this chart as a library asset, the asset id
  // is tracked here so subsequent saves update the same row.
  chartAssetId: string | null;

  // Chart instruction mode — drives how the chart appears in the written
  // instructions. See DesignerFormSnapshot.chartInstructionMode for detail.
  chartInstructionMode: 'shape-only' | 'with-chart-ref' | 'with-chart-text';

  // Chart-on-schematic placement mode. Defaults to 'tile' (chart repeats
  // across the silhouette at 1 cell per stitch — what knitters expect for
  // stitch-pattern charts). 'single' places one copy at the bottom-left
  // anchor (good for one-off motifs). 'fit' scales the chart to fill the
  // silhouette as one image (good when the chart IS the whole design).
  chartPlacement: 'tile' | 'single' | 'fit';

  // Pattern metadata — drives the printed pattern's title block and
  // (Session 3 PR 2) the publishing-copy cover page. Empty strings = unset.
  patternTitle: string;
  patternSubtitle: string;
  patternDesignerName: string;
  patternCopyright: string;
  patternSummary: string;
  patternNotes: string;

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

  // Custom — section-based draft for shapes that don't fit any of the
  // 7 preset itemTypes. Always present in form state so toggling to
  // 'custom' has something coherent to render.
  customDraft: CustomDraft;
}

const DEFAULT_FORM: DesignerForm = {
  unit: 'in',
  craft: 'knit',
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
  chartAssetId: null,
  chartInstructionMode: 'with-chart-text',
  // Default to 'fit' so the chart fills the silhouette — the most
  // intuitive view for "show me my drawing as the garment design".
  // Users with a small repeat unit can switch to 'tile' for stitch-
  // accurate tiling, or 'single' for one copy at natural stitch size.
  chartPlacement: 'fit',

  patternTitle: '',
  patternSubtitle: '',
  patternDesignerName: '',
  patternCopyright: '',
  patternSummary: '',
  patternNotes: '',

  customDraft: DEFAULT_CUSTOM_DRAFT,
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

// Form fields that hold a length (chest, sleeve, hem, etc.). When the user
// toggles unit, every value in this list converts in or out of cm so 44 in
// becomes ~112 cm rather than silently being reinterpreted as 44 cm.
const LENGTH_FIELDS: ReadonlyArray<keyof DesignerForm> = [
  'gaugeMeasurement',
  'headCircumference',
  'negativeEaseAtBrim',
  'hatTotalHeight',
  'hatBrimDepth',
  'hatCrownHeight',
  'scarfWidth',
  'scarfLength',
  'scarfFringeLength',
  'blanketWidth',
  'blanketLength',
  'blanketBorderDepth',
  'shawlWingspan',
  'handCircumference',
  'negativeEaseAtMittenCuff',
  'thumbCircumference',
  'mittenCuffDepth',
  'cuffToThumbLength',
  'thumbGussetLength',
  'thumbToTipLength',
  'thumbLength',
  'ankleCircumference',
  'negativeEaseAtSockCuff',
  'footCircumference',
  'sockCuffDepth',
  'legLength',
  'footLength',
  'chestCircumference',
  'easeAtChest',
  'totalLength',
  'hemDepth',
  'waistCircumference',
  'easeAtWaist',
  'waistHeightFromHem',
  'armholeDepth',
  'shoulderWidth',
  'necklineDepth',
  'neckOpeningWidth',
  'cuffCircumference',
  'easeAtCuff',
  'bicepCircumference',
  'easeAtBicep',
  'cuffToUnderarmLength',
  'cuffDepth',
];

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function convertFormUnits(prev: DesignerForm, target: MeasurementUnit): DesignerForm {
  if (prev.unit === target) return prev;
  const factor = target === 'cm' ? 2.54 : 1 / 2.54;
  const step = target === 'cm' ? 0.5 : 0.25;
  const next = { ...prev, unit: target };
  for (const key of LENGTH_FIELDS) {
    const v = prev[key] as NumField;
    if (typeof v === 'number' && Number.isFinite(v)) {
      (next[key] as NumField) = roundToStep(v * factor, step);
    }
  }
  return next;
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
function SaveAsPatternButton({
  form,
  patternId,
}: {
  form: DesignerForm;
  /** When set, save UPDATES this pattern instead of creating a new row.
   *  Drives the button's label and the underlying mutation. */
  patternId?: string | null;
}) {
  const navigate = useNavigate();
  const createPattern = useCreatePattern();
  const updatePattern = useUpdatePattern();
  const label = itemLabel(form.itemType);
  const isEditing = !!patternId;
  const pending = createPattern.isPending || updatePattern.isPending;

  const save = async () => {
    try {
      const gaugeText =
        form.gaugeStitches && form.gaugeRows && form.gaugeMeasurement
          ? `${form.gaugeStitches} sts × ${form.gaugeRows} rows over ${form.gaugeMeasurement} ${form.unit}`
          : undefined;
      const metadata = {
        designer: form,
        designer_snapshot_at: new Date().toISOString(),
      };
      if (isEditing && patternId) {
        const updated = await updatePattern.mutateAsync({
          id: patternId,
          formData: {
            // Preserve the existing name; the user updates it on the
            // pattern detail page if they want a rename.
            category: form.itemType,
            gauge: gaugeText,
            metadata,
          },
        });
        toast.success(`Pattern "${updated.name ?? 'Pattern'}" updated.`);
        navigate(`/patterns/${patternId}`);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const pattern = await createPattern.mutateAsync({
          name: `${label} — ${today}`,
          designer: 'Me (via Designer)',
          category: form.itemType,
          gauge: gaugeText,
          notes: `Created in the Pattern Designer on ${today}.`,
          metadata,
        });
        toast.success(`Pattern "${pattern.name}" saved to library.`);
        navigate(`/patterns/${pattern.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save as pattern');
    }
  };

  return (
    <button
      type="button"
      onClick={save}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-70 dark:border-purple-800 dark:bg-gray-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
      title={isEditing ? 'Save changes to this pattern' : 'Save this design as a reusable pattern in your library'}
    >
      <FiBook className="h-4 w-4" />
      {pending
        ? isEditing
          ? 'Saving…'
          : 'Saving…'
        : isEditing
          ? 'Save changes'
          : 'Save as pattern'}
    </button>
  );
}

/**
 * Optional metadata for the printed pattern: title, subtitle, designer
 * name, copyright line, summary blurb, designer notes. Stored on the
 * draft snapshot, surfaced by the print view's title block (and the
 * Session 3 PR 2 publishing-copy cover page).
 *
 * Rendered as a collapsed <details> so the form stays uncluttered for
 * casual users; designers shipping patterns expand it once and the field
 * values persist with the rest of the draft.
 */
function PatternMetadataPanel({
  form,
  update,
}: {
  form: DesignerForm;
  update: <K extends keyof DesignerForm>(key: K, value: DesignerForm[K]) => void;
}) {
  // Auto-expand whenever any metadata field is non-empty so a returning
  // user sees their values without having to click the disclosure.
  const hasAny =
    !!form.patternTitle ||
    !!form.patternSubtitle ||
    !!form.patternDesignerName ||
    !!form.patternCopyright ||
    !!form.patternSummary ||
    !!form.patternNotes;

  return (
    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <details open={hasAny}>
        <summary className="cursor-pointer select-none text-sm font-medium text-gray-700 dark:text-gray-300">
          Pattern info <span className="text-xs font-normal text-gray-500">(optional)</span>
        </summary>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Used in the printed pattern's title block. Leave blank to skip.
        </p>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Title
            </span>
            <input
              type="text"
              value={form.patternTitle}
              onChange={(e) => update('patternTitle', e.target.value)}
              placeholder="e.g. Cobblestone Pullover"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Subtitle
            </span>
            <input
              type="text"
              value={form.patternSubtitle}
              onChange={(e) => update('patternSubtitle', e.target.value)}
              placeholder="e.g. Worsted-weight unisex sweater"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Designer name
            </span>
            <input
              type="text"
              value={form.patternDesignerName}
              onChange={(e) => update('patternDesignerName', e.target.value)}
              placeholder="Your name or studio"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Copyright
            </span>
            <input
              type="text"
              value={form.patternCopyright}
              onChange={(e) => update('patternCopyright', e.target.value)}
              placeholder={`© ${new Date().getFullYear()} <Your name>. All rights reserved.`}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Summary
            </span>
            <textarea
              value={form.patternSummary}
              onChange={(e) => update('patternSummary', e.target.value)}
              rows={2}
              placeholder="One-paragraph description of the design"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Designer notes
            </span>
            <textarea
              value={form.patternNotes}
              onChange={(e) => update('patternNotes', e.target.value)}
              rows={3}
              placeholder="Construction notes, special techniques, suggested mods…"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
        </div>
      </details>
    </section>
  );
}

/**
 * Tiny project-context strip rendered just under the Chart section header.
 * Surfaces gauge + craft + MC label so the knitter sees their project
 * context without scrolling back up to the gauge / colors panels. Each
 * chip is dropped when the underlying data isn't set, so an unset color
 * palette doesn't render a "MC: —" placeholder.
 */
function ChartContextStrip({
  gauge,
  craft,
  paletteColors,
}: {
  gauge: { stitchesPer4in: number; rowsPer4in: number };
  craft: Craft;
  paletteColors: ColorSwatch[];
}) {
  const hasGauge = gauge.stitchesPer4in > 0 && gauge.rowsPer4in > 0;
  const mc = paletteColors[0];
  const chips: Array<{ key: string; node: React.ReactNode }> = [];

  if (hasGauge) {
    chips.push({
      key: 'gauge',
      node: (
        <span>
          <span className="text-gray-500 dark:text-gray-400">Gauge</span>{' '}
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {gauge.stitchesPer4in}×{gauge.rowsPer4in}
          </span>{' '}
          <span className="text-gray-500 dark:text-gray-400">/ 4″</span>
        </span>
      ),
    });
  }
  chips.push({
    key: 'craft',
    node: (
      <span className="capitalize text-gray-600 dark:text-gray-300">{craft}</span>
    ),
  });
  if (mc?.label) {
    chips.push({
      key: 'mc',
      node: (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm border border-gray-300 dark:border-gray-600"
            style={{ backgroundColor: mc.hex }}
            aria-hidden="true"
          />
          <span className="text-gray-500 dark:text-gray-400">MC:</span>
          <span className="text-gray-700 dark:text-gray-200">{mc.label}</span>
        </span>
      ),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="-mt-1 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {chips.map((c, i) => (
        <span key={c.key} className="inline-flex items-center">
          {c.node}
          {i < chips.length - 1 && (
            <span className="ml-4 text-gray-300 dark:text-gray-600" aria-hidden="true">
              ·
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Tiny inline editor for the chart's repeat region. The knitter speaks in
 * stitch numbers (1-indexed from the right, matching the bottom-of-chart
 * stitch labels) but ChartData stores 0-indexed columns from the left.
 * This component does the conversion in both directions and keeps the box
 * drawn on the canvas aligned with what the user typed.
 */
function RepeatRegionEditor({
  chart,
  onChange,
}: {
  chart: ChartData;
  onChange: (next: ChartData) => void;
}) {
  const region = chart.repeatRegion;
  // Display values in knitter-stitch numbering (rightmost = 1).
  const startStitch = region ? chart.width - region.endCol : '';
  const endStitch = region ? chart.width - region.startCol : '';
  // Display values in knitter-row numbering (1 = bottom).
  const startRow =
    region && typeof region.endRow === 'number' ? chart.height - region.endRow : '';
  const endRow =
    region && typeof region.startRow === 'number' ? chart.height - region.startRow : '';

  const apply = (rawStart: number | string, rawEnd: number | string) => {
    const s = typeof rawStart === 'number' ? rawStart : parseInt(rawStart, 10);
    const e = typeof rawEnd === 'number' ? rawEnd : parseInt(rawEnd, 10);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return;
    if (s < 1 || e < 1 || s > chart.width || e > chart.width) return;
    if (s > e) return;
    onChange({
      ...chart,
      repeatRegion: {
        ...(region ?? {}),
        startCol: chart.width - e,
        endCol: chart.width - s,
      },
    });
  };
  const applyRows = (rawStart: number | string, rawEnd: number | string) => {
    if (!region) return; // can't add rows without a column range
    const sStr = typeof rawStart === 'string' ? rawStart.trim() : String(rawStart);
    const eStr = typeof rawEnd === 'string' ? rawEnd.trim() : String(rawEnd);
    // Both empty → clear vertical bounds (full-height repeat is the default).
    if (sStr === '' && eStr === '') {
      const { startRow: _s, endRow: _e, ...rest } = region;
      onChange({ ...chart, repeatRegion: rest });
      return;
    }
    const s = parseInt(sStr, 10);
    const e = parseInt(eStr, 10);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return;
    if (s < 1 || e < 1 || s > chart.height || e > chart.height) return;
    if (s > e) return;
    onChange({
      ...chart,
      repeatRegion: {
        ...region,
        startRow: chart.height - e,
        endRow: chart.height - s,
      },
    });
  };
  const clear = () => {
    const next = { ...chart };
    delete next.repeatRegion;
    onChange(next);
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-gray-600 dark:text-gray-400">Repeat</span>
      <span className="text-gray-500">stitch</span>
      <input
        type="number"
        min={1}
        max={chart.width}
        value={startStitch}
        placeholder="—"
        onChange={(ev) => apply(ev.target.value, endStitch || chart.width)}
        className="w-14 rounded border border-gray-300 bg-white px-2 py-1 text-center dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        aria-label="Repeat start stitch (1 = rightmost)"
      />
      <span className="text-gray-500">to</span>
      <input
        type="number"
        min={1}
        max={chart.width}
        value={endStitch}
        placeholder="—"
        onChange={(ev) => apply(startStitch || 1, ev.target.value)}
        className="w-14 rounded border border-gray-300 bg-white px-2 py-1 text-center dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        aria-label="Repeat end stitch (1 = rightmost)"
      />
      <span className="text-gray-500">(R→L)</span>
      <span className="ml-2 text-gray-500">row</span>
      <input
        type="number"
        min={1}
        max={chart.height}
        value={startRow}
        placeholder="—"
        disabled={!region}
        onChange={(ev) => applyRows(ev.target.value, endRow || chart.height)}
        className="w-14 rounded border border-gray-300 bg-white px-2 py-1 text-center disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        aria-label="Repeat start row (1 = bottom). Optional — empty means full chart height"
        title={region ? '' : 'Set the stitch range first'}
      />
      <span className="text-gray-500">to</span>
      <input
        type="number"
        min={1}
        max={chart.height}
        value={endRow}
        placeholder="—"
        disabled={!region}
        onChange={(ev) => applyRows(startRow || 1, ev.target.value)}
        className="w-14 rounded border border-gray-300 bg-white px-2 py-1 text-center disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        aria-label="Repeat end row (1 = bottom). Optional — empty means full chart height"
      />
      <span className="text-gray-500">(opt.)</span>
      {region && (
        <button
          type="button"
          onClick={clear}
          className="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
      )}
      {region && (
        <span className="text-gray-500">
          → cast on a multiple of {region.endCol - region.startCol + 1}
          {chart.width - (region.endCol - region.startCol + 1) > 0
            ? ` sts, plus ${chart.width - (region.endCol - region.startCol + 1)}`
            : ' sts'}
        </span>
      )}
    </div>
  );
}

/**
 * Per-row notes panel. Knitters often want to attach a quick reminder
 * to specific rows ("inc 4 sts here", "switch to CC2", "begin yoke
 * shaping"). Rendered below the chart canvas; notes show in the print
 * view alongside the row's written instructions.
 *
 * Row numbers in the UI are 1-indexed from the bottom (knitter
 * convention, matches the row gutter).
 */
function RowNotesEditor({
  chart,
  onChange,
}: {
  chart: ChartData;
  onChange: (next: ChartData) => void;
}) {
  const notes = chart.rowNotes ?? {};
  const sortedRows = Object.keys(notes)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= chart.height)
    .sort((a, b) => a - b);

  const setNote = (row: number, text: string) => {
    const next = { ...notes };
    if (text.trim() === '') {
      delete next[String(row)];
    } else {
      next[String(row)] = text;
    }
    if (Object.keys(next).length === 0) {
      const { rowNotes: _r, ...rest } = chart;
      onChange(rest);
    } else {
      onChange({ ...chart, rowNotes: next });
    }
  };

  const [draftRow, setDraftRow] = useState<number | ''>('');
  const [draftText, setDraftText] = useState('');
  const addNote = () => {
    if (!draftRow || draftRow < 1 || draftRow > chart.height) return;
    if (draftText.trim() === '') return;
    setNote(draftRow, draftText);
    setDraftRow('');
    setDraftText('');
  };

  return (
    <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/40">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        Row notes {sortedRows.length > 0 && `(${sortedRows.length})`}
      </summary>
      <div className="mt-2 space-y-2">
        {sortedRows.map((row) => (
          <div key={row} className="flex items-start gap-2">
            <span className="mt-1 inline-flex w-12 flex-shrink-0 justify-end font-mono text-xs text-gray-500">
              Row {row}
            </span>
            <input
              type="text"
              value={notes[String(row)]}
              onChange={(e) => setNote(row, e.target.value)}
              className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              aria-label={`Note for row ${row}`}
            />
            <button
              type="button"
              onClick={() => setNote(row, '')}
              className="rounded text-xs text-gray-400 hover:text-red-500"
              aria-label={`Remove note for row ${row}`}
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex items-start gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
          <input
            type="number"
            min={1}
            max={chart.height}
            value={draftRow}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setDraftRow(Number.isFinite(v) ? v : '');
            }}
            placeholder="Row"
            className="mt-0.5 w-14 flex-shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-center text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            aria-label="Row number for new note"
          />
          <input
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNote();
            }}
            placeholder="Note (e.g. begin yoke shaping)"
            className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            aria-label="New note text"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={!draftRow || draftText.trim() === ''}
            className="rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </details>
  );
}

function ChartSection({
  chart,
  onChange,
  paletteColors,
  craft,
  instructionMode,
  onInstructionModeChange,
  chartAssetId,
  onChartAssetIdChange,
  defaultName,
  chartPlacement,
  onChartPlacementChange,
  suggestedChartDims,
  gauge,
}: {
  chart: ChartData | null;
  onChange: (next: ChartData | null) => void;
  paletteColors: ColorSwatch[];
  craft: Craft;
  instructionMode: DesignerForm['chartInstructionMode'];
  onInstructionModeChange: (next: DesignerForm['chartInstructionMode']) => void;
  chartAssetId: string | null;
  onChartAssetIdChange: (next: string | null) => void;
  defaultName: string;
  chartPlacement: DesignerForm['chartPlacement'];
  onChartPlacementChange: (next: DesignerForm['chartPlacement']) => void;
  /** Suggested chart canvas dims based on the active section's stitch
   *  + row count. Knitting charts map 1 cell to 1 stitch, so the canvas
   *  should match the section dimensions when designing a full motif. */
  suggestedChartDims: { width: number; height: number };
  /** Project gauge — used to compute the true-gauge cell aspect when
   *  the user toggles "True gauge" on. Falls back to square cells when
   *  either dimension is missing. */
  gauge: { stitchesPer4in: number; rowsPer4in: number };
}) {
  const defaultSymbolId = craft === 'crochet' ? 'sc' : 'k';
  const [tool, setTool] = useState<ChartTool>({ type: 'symbol', symbolId: defaultSymbolId });
  // Reset the active symbol when the user flips crafts so we never paint a
  // knit stitch while the crochet palette is showing (and vice versa).
  useEffect(() => {
    setTool((prev) =>
      prev.type === 'symbol' ? { type: 'symbol', symbolId: defaultSymbolId } : prev,
    );
  }, [craft, defaultSymbolId]);
  const [cellSize, setCellSize] = useState<number>(28);
  const [trueGauge, setTrueGauge] = useState<boolean>(false);
  // cellAspect = height / width. Knit fabric: stitches/rows ratio
  // (typical 20/28 ≈ 0.71 → cells become shorter than wide). Falls back
  // to 1 (square) if gauge is incomplete or true-gauge is off.
  const cellAspect =
    trueGauge && gauge.stitchesPer4in > 0 && gauge.rowsPer4in > 0
      ? gauge.stitchesPer4in / gauge.rowsPer4in
      : 1;
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  if (!chart) {
    return (
      <section
        id="designer-chart-section"
        className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6"
      >
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Chart <span className="text-xs font-normal text-gray-500">(optional)</span>
        </h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Design a stitch or colorwork chart to attach to this pattern. Each chart cell is one
          stitch and one row. Pick the canvas size that matches what you're designing — a full
          section design (motif fills the whole piece) or a small repeat that tiles.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(emptyChart(suggestedChartDims.width, suggestedChartDims.height))}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            title={`Match the active section's stitch dimensions (${suggestedChartDims.width}×${suggestedChartDims.height} = 1 cell per stitch)`}
          >
            Full section ({suggestedChartDims.width}×{suggestedChartDims.height})
          </button>
          <button
            type="button"
            onClick={() => onChange(emptyChart(20, 16))}
            className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
            title="Small canvas for a tiling repeat unit (cable, fair-isle motif). Use 'Repeat' placement to tile across the section."
          >
            Small repeat (20×16)
          </button>
          <button
            type="button"
            onClick={() => setShowLoadModal(true)}
            className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
          >
            Load saved chart
          </button>
        </div>
        {showLoadModal && (
          <LoadChartModal
            onClose={() => setShowLoadModal(false)}
            onSelect={(picked) => {
              if (picked.grid && (picked.grid as any).cells) {
                onChange(picked.grid as ChartData);
                onChartAssetIdChange(picked.id);
                setShowLoadModal(false);
                toast.success(`Loaded "${picked.name}"`);
              } else {
                toast.error('That chart has no grid data.');
              }
            }}
          />
        )}
      </section>
    );
  }

  const exportChart = async (format: 'pdf' | 'png' | 'svg' | 'csv' | 'markdown' | 'ravelry') => {
    if (!chartAssetId) {
      toast.info('Save the chart to your library first to enable export.');
      setShowSaveModal(true);
      return;
    }
    try {
      setExportingFormat(format);
      const res = await axios.post(
        `/api/charts/${chartAssetId}/export`,
        { format },
        { responseType: 'blob' },
      );
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chart.${format === 'ravelry' ? 'json' : format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to export as ${format}`);
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <section
      id="designer-chart-section"
      className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6"
    >
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

      {/* Project context strip — surfaces gauge + MC right next to the
          canvas so a knitter sees the project context they're charting
          against without leaving the section. Each chip is omitted when
          the underlying data isn't set. */}
      <ChartContextStrip gauge={gauge} craft={craft} paletteColors={paletteColors} />

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

      {/* Asset + export bar — save the current chart as a reusable
          library asset and export it to common knitter-friendly formats.
          Export buttons require a saved chartAssetId; clicking them
          while unsaved nudges the user to save first. */}
      <div
        className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40"
      >
        <button
          type="button"
          data-chart-save
          onClick={() => setShowSaveModal(true)}
          className="rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700"
        >
          {chartAssetId ? 'Update saved chart' : 'Save chart as asset'}
        </button>
        <button
          type="button"
          onClick={() => setShowLoadModal(true)}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Load saved chart
        </button>
        {chartAssetId && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400" title={chartAssetId}>
            Linked to library
          </span>
        )}
        <span className="ml-3 inline-flex items-center gap-1 text-xs text-gray-500">
          On schematic:
          {(
            [
              { id: 'tile' as const, label: 'Tile', help: 'Repeat across the silhouette at 1 cell per stitch (knitter default)' },
              { id: 'single' as const, label: 'Place once', help: 'Draw the chart once, anchored bottom-left, at natural stitch size' },
              { id: 'fit' as const, label: 'Fit', help: 'Scale the chart so one copy fills the silhouette as a single image' },
            ]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChartPlacementChange(opt.id)}
              aria-pressed={chartPlacement === opt.id}
              title={opt.help}
              className={`rounded border px-2 py-0.5 text-[11px] ${
                chartPlacement === opt.id
                  ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-purple-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1 text-xs text-gray-500">
          Export:
          {(['png', 'pdf', 'svg', 'csv', 'markdown', 'ravelry'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => exportChart(fmt)}
              disabled={exportingFormat !== null}
              className="rounded-md border border-gray-300 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              title={chartAssetId ? `Export as ${fmt.toUpperCase()}` : 'Save the chart first to enable export'}
            >
              {exportingFormat === fmt ? '…' : fmt}
            </button>
          ))}
        </span>
      </div>

      {showSaveModal && (
        <SaveChartModal
          chart={chart}
          chartId={chartAssetId}
          defaultName={defaultName}
          onClose={() => setShowSaveModal(false)}
          onSaved={(saved) => onChartAssetIdChange(saved.id)}
        />
      )}

      {showLoadModal && (
        <LoadChartModal
          onClose={() => setShowLoadModal(false)}
          onSelect={(picked) => {
            if (picked.grid && (picked.grid as any).cells) {
              onChange(picked.grid as ChartData);
              onChartAssetIdChange(picked.id);
              setShowLoadModal(false);
              toast.success(`Loaded "${picked.name}"`);
            } else {
              toast.error('That chart has no grid data.');
            }
          }}
        />
      )}

      {/* Workflow preset — picks the canonical "what is this chart?"
          framing in one click. Whole section sizes the canvas to the
          active section dims and anchors a single placement on the
          schematic. Repeat motif drops to a small canvas and tiles. The
          user can still tune Width / Height / On-schematic individually
          afterward. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Chart is</span>
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600">
          {(
            [
              {
                id: 'section' as const,
                label: 'Whole section',
                title: `Resize to the section's stitch × row count and anchor one copy on the schematic`,
                placement: 'single' as const,
                isActive: chartPlacement === 'single',
              },
              {
                id: 'repeat' as const,
                label: 'Repeat motif',
                title: 'Drop to a small canvas and tile across the schematic',
                placement: 'tile' as const,
                isActive: chartPlacement === 'tile',
              },
            ]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.title}
              aria-pressed={opt.isActive}
              onClick={() => {
                if (opt.id === 'section') {
                  // Resize to the suggested section dims iff they're known
                  // and differ — preserves painted cells via resizeChart.
                  const w = Math.max(1, Math.min(60, suggestedChartDims.width));
                  const h = Math.max(1, Math.min(60, suggestedChartDims.height));
                  if (w !== chart.width || h !== chart.height) {
                    onChange(resizeChart(chart, w, h));
                  }
                } else {
                  // Repeat default — small motif. Only shrink if the
                  // current canvas is bigger than the default; otherwise
                  // keep the user's existing motif size.
                  const target = { w: 8, h: 8 };
                  if (chart.width > target.w || chart.height > target.h) {
                    onChange(resizeChart(chart, target.w, target.h));
                  }
                }
                onChartPlacementChange(opt.placement);
              }}
              className={`px-3 py-1 text-xs ${
                opt.isActive
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-500">
          {chartPlacement === 'tile'
            ? 'Tiles across the schematic'
            : chartPlacement === 'single'
              ? 'Placed once at section size'
              : 'Scaled to fit the schematic'}
        </span>
      </div>

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

      {/* Construction toggle — flat work has alternating RS/WS rows; in
          the round every row is a Round (RS only). Drives the row-label
          gutter on the grid + the chart-to-text generator. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Worked</span>
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600">
          {[
            { value: false, label: 'Flat (rows)' },
            { value: true, label: 'In the round' },
          ].map((opt) => {
            const active = (chart.workedInRound ?? false) === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onChange({ ...chart, workedInRound: opt.value })}
                aria-pressed={active}
                className={`px-3 py-1 text-xs ${
                  active
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <RepeatRegionEditor chart={chart} onChange={onChange} />

      {/* True-gauge toggle. Default OFF (square cells = the universal
          chart-reading convention). Knitters who want to preview how
          stitches will look in finished fabric can flip this on; cells
          re-render with height = width × (sts/rows). */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Cells</span>
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600">
          {[
            { value: false, label: 'Square' },
            { value: true, label: 'True gauge' },
          ].map((opt) => {
            const active = trueGauge === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setTrueGauge(opt.value)}
                aria-pressed={active}
                className={`px-3 py-1 text-xs ${
                  active
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {trueGauge && gauge.stitchesPer4in > 0 && gauge.rowsPer4in > 0 && (
          <span className="text-xs text-gray-500">
            {gauge.stitchesPer4in} sts × {gauge.rowsPer4in} rows / 4″
          </span>
        )}
      </div>

      <StitchPalette
        tool={tool}
        onChange={setTool}
        paletteColors={paletteColors}
        craft={craft}
        chart={chart}
      />

      <div className="mt-4">
        <ChartGrid
          chart={chart}
          onChange={onChange}
          tool={tool}
          cellSize={cellSize}
          cellAspect={cellAspect}
        />
      </div>

      <ChartLegend chart={chart} craft={craft} paletteColors={paletteColors} />

      <RowNotesEditor chart={chart} onChange={onChange} />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(emptyChart(chart.width, chart.height))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Clear all cells
        </button>
        <span className="text-xs text-gray-500">
          Max 60×60.{' '}
          {chart.workedInRound
            ? 'Round 1 is the first round you knit.'
            : 'Row 1 (bottom, RS) is the first row you knit.'}
        </span>
      </div>

      <ChartInstructionsPanel
        chart={chart}
        craft={craft}
        mode={instructionMode}
        onModeChange={onInstructionModeChange}
      />
    </section>
  );
}

/**
 * Mode picker + (when applicable) the row-by-row chart text. Lives directly
 * under the chart grid in the live Designer. The same engine drives the
 * print view (PatternPrintView) so what knitters preview here matches what
 * prints.
 */
function ChartInstructionsPanel({
  chart,
  craft,
  mode,
  onModeChange,
}: {
  chart: ChartData;
  craft: Craft;
  mode: DesignerForm['chartInstructionMode'];
  onModeChange: (next: DesignerForm['chartInstructionMode']) => void;
}) {
  const palette = useChartSymbols(craft);
  const symbols = useMemo(() => {
    const sys = palette.data?.system ?? [];
    const cust = palette.data?.custom ?? [];
    return [...sys, ...cust];
  }, [palette.data]);

  // Side filter: knitters working a flat chart often want to focus on
  // just the RS or WS rows. In-the-round charts have no WS rows so the
  // filter collapses to "All" (the toggle is hidden).
  const [sideFilter, setSideFilter] = useState<'all' | 'rs' | 'ws'>('all');
  const showSideFilter = mode === 'with-chart-text' && !chart.workedInRound;

  const rows = useMemo(() => {
    if (mode !== 'with-chart-text') return [];
    if (!palette.data) return [];
    const all = buildChartInstructions({ chart, symbols });
    if (sideFilter === 'all' || chart.workedInRound) return all;
    if (sideFilter === 'rs') return all.filter((r) => r.isRS);
    return all.filter((r) => !r.isRS);
  }, [chart, mode, palette.data, symbols, sideFilter]);

  return (
    <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Chart in instructions
        </h3>
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600">
          {[
            { value: 'shape-only' as const, label: 'Shape only' },
            { value: 'with-chart-ref' as const, label: '+ Chart ref' },
            { value: 'with-chart-text' as const, label: '+ Chart text' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onModeChange(opt.value)}
              aria-pressed={mode === opt.value}
              className={`px-3 py-1 text-xs ${
                mode === opt.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {showSideFilter && (
          <div
            className="ml-2 inline-flex rounded-md border border-gray-300 dark:border-gray-600"
            role="group"
            aria-label="Filter rows by side"
          >
            {[
              { value: 'all' as const, label: 'All rows' },
              { value: 'rs' as const, label: 'RS only' },
              { value: 'ws' as const, label: 'WS only' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSideFilter(opt.value)}
                aria-pressed={sideFilter === opt.value}
                className={`px-3 py-1 text-xs ${
                  sideFilter === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {mode === 'shape-only' && (
        <p className="text-xs text-gray-500">
          The chart appears in the print view but the written instructions don't reference it.
        </p>
      )}
      {mode === 'with-chart-ref' && (
        <p className="text-xs text-gray-500">
          Instructions read "Work Chart for {chart.height}{' '}
          {chart.workedInRound ? 'rounds' : 'rows'}." The chart itself is printed alongside.
        </p>
      )}
      {mode === 'with-chart-text' && (
        <>
          {palette.isLoading && (
            <p className="text-xs text-gray-500">Loading stitch templates…</p>
          )}
          {palette.isError && (
            <p className="text-xs text-red-600">Couldn't load stitch templates.</p>
          )}
          {!palette.isLoading && !palette.isError && rows.length > 0 && (
            <ol className="space-y-1 text-sm">
              {rows.map((r) => (
                <li key={r.rowNumber} className="flex flex-wrap gap-2">
                  <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {r.prefix}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">
                    {r.isEmpty ? <em className="text-gray-400">(empty row)</em> : r.body}
                  </span>
                  {r.warnings.length > 0 && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      ⚠ {r.warnings.join('; ')}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function PatternDesigner() {
  const { prefs } = useMeasurementPrefs();
  // Designer only renders in/cm. Profile pref may be 'mm' (used for needle
  // sizing); fall back to cm since body measurements in mm aren't meaningful.
  const desiredUnit: MeasurementUnit = prefs.lengthDisplayUnit === 'cm' || prefs.lengthDisplayUnit === 'mm' ? 'cm' : 'in';

  // Edit-mode entry point: `/designer?patternId=xxx` loads an existing
  // pattern's saved Designer snapshot into the form, so the Save button
  // updates the same row instead of creating a duplicate. New-pattern flow
  // (no query param) keeps using localStorage as a draft buffer.
  const [searchParams] = useSearchParams();
  const editingPatternId = searchParams.get('patternId');

  const [form, setForm] = useState<DesignerForm>(() => {
    const saved = readSavedForm();
    return saved.unit === desiredUnit ? saved : convertFormUnits(saved, desiredUnit);
  });
  const [loadingPattern, setLoadingPattern] = useState<boolean>(!!editingPatternId);
  const navigate = useNavigate();

  // When ?patternId is set, fetch the pattern and replace the form state
  // with its saved Designer snapshot. The localStorage draft is left
  // untouched so the user can pop back to a fresh new-pattern flow.
  useEffect(() => {
    if (!editingPatternId) return;
    let cancelled = false;
    setLoadingPattern(true);
    (async () => {
      try {
        const { data } = await axios.get(`/api/patterns/${editingPatternId}`);
        const pattern = data?.data?.pattern ?? data?.data;
        const snapshot = pattern?.metadata?.designer as DesignerForm | undefined;
        if (cancelled) return;
        if (snapshot) {
          setForm(
            snapshot.unit === desiredUnit
              ? snapshot
              : convertFormUnits(snapshot, desiredUnit),
          );
        } else {
          toast.info(
            'This pattern has no saved Designer snapshot — opening a fresh draft.',
          );
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load pattern';
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoadingPattern(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingPatternId, desiredUnit]);
  // Zoom level for the schematic preview. 1 = default 24rem cap, larger
  // values let the silhouette grow so colorwork and stitch symbols are
  // legible. Container handles horizontal scroll past the viewport.
  const [schematicZoom, setSchematicZoom] = useState<number>(1);
  const mainColor = form.colors[0]?.hex ?? null;

  // Re-convert the form whenever the user's profile preference changes so
  // the Designer always reflects their global setting.
  useEffect(() => {
    setForm((prev) => (prev.unit === desiredUnit ? prev : convertFormUnits(prev, desiredUnit)));
  }, [desiredUnit]);

  useEffect(() => {
    // Don't overwrite the new-pattern draft with an in-progress edit of
    // a saved pattern — the localStorage buffer is only for the
    // unsaved /designer flow.
    if (editingPatternId) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(form));
    } catch {
      /* storage unavailable */
    }
  }, [form, editingPatternId]);

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

  const customDraftOutput = useMemo(() => {
    if (!gaugeReady(form)) return null;
    try {
      return computeCustomDraft({
        draft: form.customDraft,
        gauge: normalizedGauge(form),
      });
    } catch (e) {
      console.error('[Designer] custom-draft compute error:', e);
      return null;
    }
  }, [form]);

  const update = <K extends keyof DesignerForm>(key: K, value: DesignerForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Suggested chart dimensions for the active section. Knitting charts
  // map 1 cell to 1 stitch and 1 cell to 1 row, so the canvas should
  // match the section's actual stitch + row count when the user wants
  // to design a full-section motif (fair-isle yoke, full sweater body,
  // etc.). The suggestion is capped at 200×200 — beyond that the chart
  // grid becomes hard to interact with and the user can resize down.
  const suggestedChartDims = useMemo<{ width: number; height: number }>(() => {
    const cap = 200;
    const clamp = (n: number) => Math.max(8, Math.min(cap, Math.round(n)));
    if (form.itemType === 'sweater' && form.activeSection === 'body' && bodyOutput) {
      // Body chart: cast-on stitches × total rows. For a 40" worsted
      // body that's typically ~100×150.
      return { width: clamp(bodyOutput.castOnStitches), height: clamp(bodyOutput.totalRows) };
    }
    if (form.itemType === 'sweater' && form.activeSection === 'sleeve' && sleeveOutput) {
      // Sleeve chart: bicep is the widest point, total rows includes cap.
      return {
        width: clamp(sleeveOutput.bicepStitches),
        height: clamp(sleeveOutput.totalRows),
      };
    }
    if (form.itemType === 'hat' && hatOutput) {
      return { width: clamp(hatOutput.castOnStitches), height: clamp(hatOutput.brimRows + hatOutput.bodyRows + hatOutput.crownRows) };
    }
    if (form.itemType === 'scarf' && scarfOutput) {
      return { width: clamp(scarfOutput.castOnStitches), height: clamp(scarfOutput.totalRows) };
    }
    if (form.itemType === 'blanket' && blanketOutput) {
      return { width: clamp(blanketOutput.castOnStitches), height: clamp(blanketOutput.totalRows) };
    }
    if (form.itemType === 'shawl' && shawlOutput) {
      // Top-down triangle: starts narrow at apex, ends wide at wingspan.
      // Chart should be sized to the widest point (final stitches).
      return { width: clamp(shawlOutput.finalStitches), height: clamp(shawlOutput.totalRows) };
    }
    if (form.itemType === 'mittens' && mittenOutput) {
      return { width: clamp(mittenOutput.handStitches), height: clamp(mittenOutput.totalRows) };
    }
    if (form.itemType === 'socks' && sockOutput) {
      return { width: clamp(sockOutput.castOnStitches), height: clamp(sockOutput.totalRows) };
    }
    if (form.itemType === 'custom' && customDraftOutput) {
      return {
        width: clamp(customDraftOutput.startingStitches),
        height: clamp(customDraftOutput.totalRows),
      };
    }
    // Fallback when the form isn't ready: small starter canvas the user
    // can resize manually.
    return { width: 20, height: 16 };
  }, [
    form.itemType,
    form.activeSection,
    bodyOutput,
    sleeveOutput,
    hatOutput,
    scarfOutput,
    blanketOutput,
    shawlOutput,
    mittenOutput,
    sockOutput,
    customDraftOutput,
  ]);

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
          {editingPatternId && (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
              title="Editing an existing pattern"
            >
              {loadingPattern ? 'Loading…' : 'Editing'}
            </span>
          )}
          {/* Craft toggle — drives which stitch palette shows + future
              construction-math forks. Persisted with the rest of the form. */}
          <div
            className="ml-2 inline-flex overflow-hidden rounded-full border border-purple-300 text-xs font-medium dark:border-purple-700"
            role="group"
            aria-label="Craft"
          >
            {(['knit', 'crochet'] as const).map((c) => {
              const active = form.craft === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => update('craft', c)}
                  aria-pressed={active}
                  className={`px-3 py-1 transition ${
                    active
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-purple-700 hover:bg-purple-50 dark:bg-gray-800 dark:text-purple-200 dark:hover:bg-purple-900/30'
                  }`}
                >
                  {c === 'knit' ? 'Knit' : 'Crochet'}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {editingPatternId && (
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm(
                    'Cancel editing and discard any unsaved changes? Your saved pattern is untouched.',
                  );
                  if (!ok) return;
                  navigate(`/patterns/${editingPatternId}`);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                title="Discard unsaved changes and go back to the pattern"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  editingPatternId
                    ? 'Discard changes and start a brand-new design? Your saved pattern is untouched — this just clears the form.'
                    : 'Clear the form and start a new design? Your local draft will be wiped.',
                );
                if (!ok) return;
                setForm(DEFAULT_FORM);
                if (editingPatternId) {
                  // Drop the ?patternId param so the form is no longer in
                  // edit mode — fresh new-design flow from here.
                  navigate('/designer');
                }
                toast.success('Started a new design.');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:bg-gray-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
              title="Clear the form and start a fresh design"
            >
              <FiFilePlus className="h-4 w-4" />
              New design
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('designer-chart-section');
                if (!el) return;
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Briefly highlight the save button so the user sees where
                // it is once they're scrolled there.
                const saveBtn = el.querySelector('[data-chart-save]') as HTMLElement | null;
                if (saveBtn) {
                  saveBtn.classList.add('ring-2', 'ring-purple-500');
                  setTimeout(() => saveBtn.classList.remove('ring-2', 'ring-purple-500'), 1800);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:bg-gray-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
              title="Jump to the chart and save it as a reusable asset"
            >
              <FiSave className="h-4 w-4" />
              Save chart
            </button>
            <SaveAsPatternButton form={form} patternId={editingPatternId} />
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
        {/* Inputs — Gauge first; unit comes from the user's profile preference */}
        <div className="space-y-4 lg:col-span-2">
          <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
            Measurements shown in{' '}
            <strong className="font-medium">
              {form.unit === 'in' ? 'inches' : 'centimeters'}
            </strong>
            .{' '}
            <Link
              to="/profile?tab=units"
              className="text-purple-600 hover:underline dark:text-purple-300"
            >
              Change in Profile
            </Link>
          </p>

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
          <ColorPalette
            colors={form.colors}
            onChange={(next) => update('colors', next)}
            // When a swatch hex is edited, also re-map any chart cells
            // that were painted with the old hex so the chart stays in
            // sync with the palette. Without this, the swatch updates
            // but the chart silently keeps the old color.
            onHexChanged={(oldHex, newHex) => {
              const chart = form.chart;
              if (!chart) return;
              const oldUp = oldHex.toUpperCase();
              let touched = false;
              const cells = chart.cells.map((c) => {
                if (c.colorHex && c.colorHex.toUpperCase() === oldUp) {
                  touched = true;
                  return { ...c, colorHex: newHex };
                }
                return c;
              });
              if (touched) update('chart', { ...chart, cells });
            }}
          />

          {/* Pattern info — optional metadata used by the printed pattern's
              title block (and Session 3 PR 2's publishing-copy cover page).
              Collapsed by default to keep the form quiet for casual users. */}
          <PatternMetadataPanel form={form} update={update} />

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
                Custom shape — section draft
              </h2>
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                Build any garment piece by stacking knitting sections. Each section sets how many
                rows you work, what kind of work (straight, ribbing, increase, decrease, cast off,
                bind off), and how many stitches change at each edge. Stitch counts thread
                automatically from the cast-on through every section.
              </p>
              <CustomDraftEditor
                draft={form.customDraft}
                onChange={(next) => update('customDraft', next)}
              />
            </section>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
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
              <div className="flex flex-wrap items-center gap-3">
                {form.chart && (
                  <div className="flex items-center gap-1" title="How the chart maps onto the schematic">
                    <span className="text-xs text-gray-500">Chart:</span>
                    {(
                      [
                        { id: 'single' as const, label: 'Once', help: 'Show the chart one time, anchored bottom-left at natural stitch size' },
                        { id: 'tile' as const, label: 'Repeat', help: 'Tile the chart across the silhouette at 1 cell per stitch (use for stitch patterns / fair-isle repeats)' },
                        { id: 'fit' as const, label: 'Fill', help: 'Stretch the chart to fill the silhouette as one image' },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => update('chartPlacement', opt.id)}
                        aria-pressed={form.chartPlacement === opt.id}
                        title={opt.help}
                        className={`rounded border px-2 py-0.5 text-xs ${
                          form.chartPlacement === opt.id
                            ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-purple-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Zoom</span>
                  {[
                    { label: '1×', value: 1 },
                    { label: '1.5×', value: 1.5 },
                    { label: '2×', value: 2 },
                    { label: '3×', value: 3 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setSchematicZoom(opt.value)}
                      aria-pressed={schematicZoom === opt.value}
                      className={`rounded border px-2 py-0.5 text-xs ${
                        schematicZoom === opt.value
                          ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-purple-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
            {form.itemType === 'hat' && hatOutput ? (
              <HatSchematic output={hatOutput} unit={form.unit} chart={form.chart} mainColor={mainColor} zoom={schematicZoom} chartPlacement={form.chartPlacement} />
            ) : form.itemType === 'mittens' && mittenOutput ? (
              <MittenSchematic output={mittenOutput} unit={form.unit} chart={form.chart} mainColor={mainColor} zoom={schematicZoom} chartPlacement={form.chartPlacement} />
            ) : form.itemType === 'socks' && sockOutput ? (
              <SockSchematic output={sockOutput} unit={form.unit} chart={form.chart} mainColor={mainColor} zoom={schematicZoom} chartPlacement={form.chartPlacement} />
            ) : form.itemType === 'shawl' && shawlOutput ? (
              <ShawlSchematic output={shawlOutput} unit={form.unit} chart={form.chart} mainColor={mainColor} zoom={schematicZoom} chartPlacement={form.chartPlacement} />
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
                mainColor={mainColor}
                zoom={schematicZoom}
                chartPlacement={form.chartPlacement}
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
                mainColor={mainColor}
                zoom={schematicZoom}
                chartPlacement={form.chartPlacement}
              />
            ) : form.itemType === 'sweater' && form.activeSection === 'body' && bodyOutput ? (
              <BodySchematic
                input={buildBodyInput(form)}
                output={bodyOutput}
                unit={form.unit}
                chart={form.chart}
                mainColor={mainColor}
                zoom={schematicZoom}
                chartPlacement={form.chartPlacement}
              />
            ) : form.itemType === 'sweater' && form.activeSection === 'sleeve' && sleeveOutput ? (
              <SleeveSchematic
                input={buildSleeveInput(form, bodyOutput?.armholeInitialBindOffPerSide ?? null)}
                output={sleeveOutput}
                unit={form.unit}
                chart={form.chart}
                mainColor={mainColor}
                zoom={schematicZoom}
                chartPlacement={form.chartPlacement}
              />
            ) : form.itemType === 'custom' && customDraftOutput ? (
              <CustomDraftSchematic
                output={customDraftOutput}
                unit={form.unit}
                chart={form.chart}
                mainColor={mainColor}
                zoom={schematicZoom}
                chartPlacement={form.chartPlacement}
              />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
                Fill in gauge and section measurements to see the schematic.
              </div>
            )}
            </div>

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

          <YardageEstimateWidget form={form} />

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
        craft={form.craft}
        instructionMode={form.chartInstructionMode ?? 'with-chart-text'}
        onInstructionModeChange={(next) => update('chartInstructionMode', next)}
        chartAssetId={form.chartAssetId}
        onChartAssetIdChange={(next) => update('chartAssetId', next)}
        defaultName={form.patternTitle?.trim() || `${itemLabel(form.itemType)} chart`}
        chartPlacement={form.chartPlacement ?? 'tile'}
        onChartPlacementChange={(next) => update('chartPlacement', next)}
        suggestedChartDims={suggestedChartDims}
        gauge={normalizedGauge(form)}
      />
    </div>
  );
}
