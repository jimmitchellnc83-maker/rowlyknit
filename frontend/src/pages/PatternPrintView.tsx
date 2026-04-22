import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiPrinter } from 'react-icons/fi';
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
  type BodyBlockOutput,
  type HatInput,
  type MittenInput,
  type ScarfInput,
  type ShawlInput,
  type SleeveInput,
  type SockInput,
  type MeasurementUnit,
} from '../utils/designerMath';
import BodySchematic from '../components/designer/BodySchematic';
import HatSchematic from '../components/designer/HatSchematic';
import MittenSchematic from '../components/designer/MittenSchematic';
import RectSchematic from '../components/designer/RectSchematic';
import ShawlSchematic from '../components/designer/ShawlSchematic';
import SleeveSchematic from '../components/designer/SleeveSchematic';
import SockSchematic from '../components/designer/SockSchematic';
import type { ColorSwatch } from '../components/designer/ColorPalette';
import { estimateYardageFromArea, formatYardage, type YardageRange } from '../utils/yardageEstimate';

/**
 * Clean printable pattern write-up. Reads the same localStorage key the
 * designer page writes to, recomputes outputs, and formats them as a
 * document a knitter can print or save as PDF (via the browser's print
 * dialog — "Save as PDF" works everywhere).
 *
 * Not a separate data model — this is a pure presentation layer over the
 * designer form state. The Designer page owns the inputs; the print view
 * is a rendering of the latest state.
 */

const LS_KEY = 'rowly:designer:current';

// Minimal subset of DesignerForm we need to re-derive inputs. Kept as a
// local type so the print view doesn't have to import the full form type
// from the designer page.
interface DesignerFormSnapshot {
  unit: MeasurementUnit;
  gaugeStitches: number | '';
  gaugeRows: number | '';
  gaugeMeasurement: number | '';
  itemType: string;
  activeSection: string;

  // Body
  chestCircumference: number | '';
  easeAtChest: number | '';
  totalLength: number | '';
  hemDepth: number | '';
  useWaistShaping: boolean;
  waistCircumference: number | '';
  easeAtWaist: number | '';
  waistHeightFromHem: number | '';
  useArmhole: boolean;
  armholeDepth: number | '';
  shoulderWidth: number | '';
  panelType: 'front' | 'back';
  necklineDepth: number | '';
  neckOpeningWidth: number | '';

  // Sleeve
  cuffCircumference: number | '';
  easeAtCuff: number | '';
  bicepCircumference: number | '';
  easeAtBicep: number | '';
  cuffToUnderarmLength: number | '';
  cuffDepth: number | '';

  // Hat
  headCircumference: number | '';
  negativeEaseAtBrim: number | '';
  hatTotalHeight: number | '';
  hatBrimDepth: number | '';
  hatCrownHeight: number | '';

  // Scarf
  scarfWidth: number | '';
  scarfLength: number | '';
  scarfFringeLength: number | '';

  // Blanket
  blanketWidth: number | '';
  blanketLength: number | '';
  blanketBorderDepth: number | '';

  // Shawl
  shawlWingspan: number | '';
  shawlInitialCastOn: number | '';

  // Mittens
  handCircumference: number | '';
  negativeEaseAtMittenCuff: number | '';
  thumbCircumference: number | '';
  mittenCuffDepth: number | '';
  cuffToThumbLength: number | '';
  thumbGussetLength: number | '';
  thumbToTipLength: number | '';
  thumbLength: number | '';

  // Socks
  ankleCircumference: number | '';
  negativeEaseAtSockCuff: number | '';
  footCircumference: number | '';
  sockCuffDepth: number | '';
  legLength: number | '';
  footLength: number | '';

  colors: ColorSwatch[];
}

function readForm(): DesignerFormSnapshot | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DesignerFormSnapshot;
  } catch {
    return null;
  }
}

function normGauge(f: DesignerFormSnapshot) {
  const m = toInches(f.gaugeMeasurement as number, f.unit);
  return {
    stitchesPer4in: ((f.gaugeStitches as number) / m) * 4,
    rowsPer4in: ((f.gaugeRows as number) / m) * 4,
  };
}

function itemTitle(t: string): string {
  const map: Record<string, string> = {
    sweater: 'Sweater',
    hat: 'Hat',
    scarf: 'Scarf',
    blanket: 'Blanket',
    shawl: 'Shawl',
    mittens: 'Mittens',
    socks: 'Socks',
  };
  return map[t] ?? 'Pattern';
}

// ---------------------------------------------------------------------------
// Print-scoped styles. Applied inline so they're guaranteed to reach the
// print layout (no CSS-module / tailwind-purge surprises).
// ---------------------------------------------------------------------------

const PRINT_STYLES = `
  @media print {
    /* Hide the global app chrome (sidebar, top bars, sync indicator). */
    aside, nav.fixed, .fixed.top-4, [aria-label="Back to Designer"], [data-print-hide="true"] {
      display: none !important;
    }
    /* Let the print-view fill the page. */
    body { background: white !important; }
    .md\\:ml-64 { margin-left: 0 !important; }
    /* Page breaks between major sections. */
    .print-page-break { break-before: page; }
    .print-avoid-break { break-inside: avoid; }
    /* Readable typography. */
    body, .print-body { font-size: 11pt; line-height: 1.5; color: black !important; }
    h1 { font-size: 22pt; }
    h2 { font-size: 14pt; }
  }
`;

export default function PatternPrintView() {
  const form = useMemo(() => readForm(), []);

  if (!form) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-700 dark:text-gray-300">
          No design found. Visit the{' '}
          <Link to="/designer" className="text-purple-600 underline">
            Designer
          </Link>{' '}
          to create one, then return here to print.
        </p>
      </div>
    );
  }

  const gauge = normGauge(form);
  const unitLabel = form.unit === 'cm' ? 'cm' : 'in';

  return (
    <div className="max-w-4xl mx-auto p-6 print-body">
      <style>{PRINT_STYLES}</style>

      {/* Toolbar — hidden in print */}
      <div className="mb-6 flex items-center justify-between" data-print-hide="true">
        <Link
          to="/designer"
          className="inline-flex items-center gap-2 text-sm text-purple-700 hover:underline"
          aria-label="Back to Designer"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to Designer
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          <FiPrinter className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Pattern header */}
      <header className="mb-6 border-b border-gray-300 pb-4 print-avoid-break">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {itemTitle(form.itemType)}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Generated {new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {' · '}
          Gauge {form.gaugeStitches} sts × {form.gaugeRows} rows over {form.gaugeMeasurement}{' '}
          {unitLabel}
        </p>

        {form.colors.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Colors</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {form.colors.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded border border-gray-400"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden="true"
                  />
                  <span className="text-sm">
                    {i === 0 ? 'MC · ' : ''}
                    {c.label}{' '}
                    <span className="font-mono text-xs text-gray-500">{c.hex.toUpperCase()}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Render by item type */}
      {form.itemType === 'sweater' && <SweaterPrint form={form} gauge={gauge} />}
      {form.itemType === 'hat' && <HatPrint form={form} gauge={gauge} />}
      {form.itemType === 'scarf' && <ScarfPrint form={form} gauge={gauge} />}
      {form.itemType === 'blanket' && <BlanketPrint form={form} gauge={gauge} />}
      {form.itemType === 'shawl' && <ShawlPrint form={form} gauge={gauge} />}
      {form.itemType === 'mittens' && <MittensPrint form={form} gauge={gauge} />}
      {form.itemType === 'socks' && <SocksPrint form={form} gauge={gauge} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-item-type print sections. Each renders the schematic + shaping schedule.
// ---------------------------------------------------------------------------

type PrintProps<F = DesignerFormSnapshot> = {
  form: F;
  gauge: { stitchesPer4in: number; rowsPer4in: number };
};

function StepList({ steps }: { steps: BodyBlockOutput['steps'] }) {
  return (
    <ol className="space-y-3 print-avoid-break">
      {steps.map((step, i) => (
        <li key={i} className="print-avoid-break">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{i + 1}. {step.label}</span>
            <span className="text-xs text-gray-500">
              {step.startStitches === 0
                ? `${step.endStitches} sts`
                : step.endStitches === 0
                  ? `${step.startStitches} sts`
                  : `${step.startStitches} → ${step.endStitches} sts`}
              {step.rows > 1 && <> · {step.rows} rows</>}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">{step.instruction}</p>
        </li>
      ))}
    </ol>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 print-avoid-break">
      <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </section>
  );
}

function YardageCard({ yardage }: { yardage: YardageRange }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm print-avoid-break">
      <p className="font-semibold text-amber-900">Estimated yardage: {formatYardage(yardage)}</p>
      <p className="mt-1 text-xs text-amber-800">
        Rough range based on finished area and gauge. Cables use more, lace uses less.
        Buy a bit extra for swatching and weaving in ends.
      </p>
    </div>
  );
}

function SweaterPrint({ form, gauge }: PrintProps) {
  const bodyInput: BodyBlockInput = {
    gauge,
    chestCircumference: toInches(form.chestCircumference as number, form.unit),
    easeAtChest: toInches(form.easeAtChest as number, form.unit),
    totalLength: toInches(form.totalLength as number, form.unit),
    hemDepth: toInches(form.hemDepth as number, form.unit),
    waist: form.useWaistShaping
      ? {
          waistCircumference: toInches(form.waistCircumference as number, form.unit),
          easeAtWaist: toInches(form.easeAtWaist as number, form.unit),
          waistHeightFromHem: toInches(form.waistHeightFromHem as number, form.unit),
        }
      : undefined,
    armhole: form.useArmhole
      ? {
          armholeDepth: toInches(form.armholeDepth as number, form.unit),
          shoulderWidth: toInches(form.shoulderWidth as number, form.unit),
        }
      : undefined,
    neckline:
      form.useArmhole && form.panelType === 'front'
        ? {
            necklineDepth: toInches(form.necklineDepth as number, form.unit),
            neckOpeningWidth: toInches(form.neckOpeningWidth as number, form.unit),
          }
        : undefined,
  };
  const body = computeBodyBlock(bodyInput);

  const sleeveInput: SleeveInput = {
    gauge,
    cuffCircumference: toInches(form.cuffCircumference as number, form.unit),
    easeAtCuff: toInches(form.easeAtCuff as number, form.unit),
    bicepCircumference: toInches(form.bicepCircumference as number, form.unit),
    easeAtBicep: toInches(form.easeAtBicep as number, form.unit),
    cuffToUnderarmLength: toInches(form.cuffToUnderarmLength as number, form.unit),
    cuffDepth: toInches(form.cuffDepth as number, form.unit),
    cap:
      form.useArmhole && body.armholeInitialBindOffPerSide !== null
        ? {
            matchingArmholeDepth: toInches(form.armholeDepth as number, form.unit),
            matchingArmholeInitialBindOff: body.armholeInitialBindOffPerSide,
          }
        : undefined,
  };
  const sleeve = computeSleeve(sleeveInput);

  // Finished area: 2 × (body panel = chest × length) + 2 × (sleeve trapezoid area ≈ avg-width × length).
  const bodyPanelArea = body.finishedChest * body.finishedLength;
  const sleeveArea =
    ((sleeve.finishedCuff + sleeve.finishedBicep) / 2) * sleeve.finishedTotalLength;
  const yardage = estimateYardageFromArea(2 * bodyPanelArea + 2 * sleeveArea, gauge);

  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Chest: {body.finishedChest} in (cast-on {body.castOnStitches} sts)</li>
          <li>Total length: {body.finishedLength} in</li>
          {body.finishedWaist !== null && <li>Waist: {body.finishedWaist} in</li>}
          <li>Sleeve: {sleeve.finishedTotalLength} in ({sleeve.bicepStitches} sts at bicep)</li>
          <li>Cuff: {sleeve.finishedCuff} in</li>
        </ul>
      </Section>

      <Section title="Yarn">
        <YardageCard yardage={yardage} />
      </Section>

      <Section title="Body — schematic">
        <BodySchematic input={bodyInput} output={body} />
      </Section>
      <Section title="Body — instructions">
        <StepList steps={body.steps} />
      </Section>

      <div className="print-page-break">
        <Section title="Sleeve — schematic">
          <SleeveSchematic input={sleeveInput} output={sleeve} />
        </Section>
        <Section title="Sleeve — instructions">
          <StepList steps={sleeve.steps} />
        </Section>
      </div>
    </>
  );
}

function HatPrint({ form, gauge }: PrintProps) {
  const input: HatInput = {
    gauge,
    headCircumference: toInches(form.headCircumference as number, form.unit),
    negativeEaseAtBrim: toInches(form.negativeEaseAtBrim as number, form.unit),
    totalHeight: toInches(form.hatTotalHeight as number, form.unit),
    brimDepth: toInches(form.hatBrimDepth as number, form.unit),
    crownHeight: toInches(form.hatCrownHeight as number, form.unit),
  };
  const out = computeHat(input);
  // Hat ~ cylinder opened flat = circumference × height, minus a bit for the taper.
  const yardage = estimateYardageFromArea(
    out.finishedCircumference * out.finishedHeight * 0.9,
    gauge,
  );
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Circumference: {out.finishedCircumference} in ({out.castOnStitches} sts)</li>
          <li>Total height: {out.finishedHeight} in</li>
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} />
      </Section>
      <Section title="Schematic">
        <HatSchematic output={out} />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function ScarfPrint({ form, gauge }: PrintProps) {
  const input: ScarfInput = {
    gauge,
    width: toInches(form.scarfWidth as number, form.unit),
    length: toInches(form.scarfLength as number, form.unit),
    fringeLength: toInches(form.scarfFringeLength as number, form.unit),
  };
  const out = computeScarf(input);
  const yardage = estimateYardageFromArea(out.finishedWidth * out.finishedLength, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Width: {out.finishedWidth} in ({out.castOnStitches} sts)</li>
          <li>Length: {out.finishedLength} in ({out.totalRows} rows)</li>
          {out.fringeLength > 0 && <li>Fringe: {out.fringeLength} in per side</li>}
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} />
      </Section>
      <Section title="Schematic">
        <RectSchematic
          label="Scarf"
          accent="purple"
          widthInches={out.finishedWidth}
          lengthInches={out.finishedLength}
          castOnStitches={out.castOnStitches}
          fringeInches={out.fringeLength}
        />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function BlanketPrint({ form, gauge }: PrintProps) {
  const input: BlanketInput = {
    gauge,
    width: toInches(form.blanketWidth as number, form.unit),
    length: toInches(form.blanketLength as number, form.unit),
    borderDepth: toInches(form.blanketBorderDepth as number, form.unit),
  };
  const out = computeBlanket(input);
  const yardage = estimateYardageFromArea(out.finishedWidth * out.finishedLength, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Width: {out.finishedWidth} in ({out.castOnStitches} sts)</li>
          <li>Length: {out.finishedLength} in ({out.totalRows} rows)</li>
          {out.borderStitchesPerSide > 0 && (
            <li>Border: {out.borderStitchesPerSide} sts each side</li>
          )}
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} />
      </Section>
      <Section title="Schematic">
        <RectSchematic
          label="Blanket"
          accent="green"
          widthInches={out.finishedWidth}
          lengthInches={out.finishedLength}
          castOnStitches={out.castOnStitches}
          borderInches={typeof form.blanketBorderDepth === 'number' ? form.blanketBorderDepth : 0}
        />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function ShawlPrint({ form, gauge }: PrintProps) {
  const input: ShawlInput = {
    gauge,
    wingspan: toInches(form.shawlWingspan as number, form.unit),
    initialCastOn: form.shawlInitialCastOn as number,
  };
  const out = computeShawl(input);
  // Triangle area = wingspan × depth × 0.5.
  const yardage = estimateYardageFromArea(
    out.finishedWingspan * out.finishedDepth * 0.5,
    gauge,
  );
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Wingspan: {out.finishedWingspan} in ({out.finalStitches} sts)</li>
          <li>Depth at center spine: {out.finishedDepth} in</li>
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} />
      </Section>
      <Section title="Schematic">
        <ShawlSchematic output={out} />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function MittensPrint({ form, gauge }: PrintProps) {
  const input: MittenInput = {
    gauge,
    handCircumference: toInches(form.handCircumference as number, form.unit),
    negativeEaseAtCuff: toInches(form.negativeEaseAtMittenCuff as number, form.unit),
    thumbCircumference: toInches(form.thumbCircumference as number, form.unit),
    cuffDepth: toInches(form.mittenCuffDepth as number, form.unit),
    cuffToThumbLength: toInches(form.cuffToThumbLength as number, form.unit),
    thumbGussetLength: toInches(form.thumbGussetLength as number, form.unit),
    thumbToTipLength: toInches(form.thumbToTipLength as number, form.unit),
    thumbLength: toInches(form.thumbLength as number, form.unit),
  };
  const out = computeMittens(input);
  // Two mittens: 2 × (hand_circ × length) + a small thumb allowance.
  const yardage = estimateYardageFromArea(
    2 * (out.finishedHandCircumference * out.finishedLength + out.finishedThumbCircumference * 2.5),
    gauge,
  );
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Hand: {out.finishedHandCircumference} in ({out.handStitches} sts)</li>
          <li>Thumb: {out.finishedThumbCircumference} in ({out.thumbStitches} sts)</li>
          <li>Total length: {out.finishedLength} in</li>
        </ul>
      </Section>
      <Section title="Yarn (pair)">
        <YardageCard yardage={yardage} />
      </Section>
      <Section title="Schematic">
        <MittenSchematic output={out} />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function SocksPrint({ form, gauge }: PrintProps) {
  const input: SockInput = {
    gauge,
    ankleCircumference: toInches(form.ankleCircumference as number, form.unit),
    negativeEaseAtCuff: toInches(form.negativeEaseAtSockCuff as number, form.unit),
    footCircumference: toInches(form.footCircumference as number, form.unit),
    cuffDepth: toInches(form.sockCuffDepth as number, form.unit),
    legLength: toInches(form.legLength as number, form.unit),
    footLength: toInches(form.footLength as number, form.unit),
  };
  const out = computeSocks(input);
  // Two socks: each ~ ankle circ × total length (rough tube approximation).
  const yardage = estimateYardageFromArea(
    2 * out.finishedAnkleCircumference * out.finishedTotalLength,
    gauge,
  );
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Ankle: {out.finishedAnkleCircumference} in ({out.castOnStitches} sts)</li>
          <li>Foot: {out.finishedFootCircumference} in</li>
          <li>Total length: {out.finishedTotalLength} in</li>
        </ul>
      </Section>
      <Section title="Yarn (pair)">
        <YardageCard yardage={yardage} />
      </Section>
      <Section title="Schematic">
        <SockSchematic output={out} />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}
