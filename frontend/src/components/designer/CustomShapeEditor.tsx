import { useRef, useState } from 'react';
import { type CustomShape, type CustomVertex } from '../../types/customShape';

interface CustomShapeEditorProps {
  shape: CustomShape;
  onChange: (next: CustomShape) => void;
}

/**
 * Interactive vertex editor for a custom polygon. Drag the dots to move
 * vertices, click between two adjacent dots to add a new vertex at that
 * midpoint, and use the "Remove" button to delete the currently
 * selected vertex (when 4+ vertices are present so the polygon stays
 * valid).
 *
 * Coordinates are normalized 0–1 in the shape data; this component
 * handles the screen ↔ shape mapping so the parent doesn't have to
 * think in pixels.
 */
export default function CustomShapeEditor({ shape, onChange }: CustomShapeEditorProps) {
  const viewW = 320;
  const viewH = 320;
  const marginX = 30;
  const marginY = 30;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;

  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const toScreen = (v: CustomVertex) => ({
    x: marginX + v.x * areaW,
    y: marginY + v.y * areaH,
  });

  const toShape = (clientX: number, clientY: number): CustomVertex => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * viewW;
    const sy = ((clientY - rect.top) / rect.height) * viewH;
    return {
      x: Math.max(0, Math.min(1, (sx - marginX) / areaW)),
      y: Math.max(0, Math.min(1, (sy - marginY) / areaH)),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx === null) return;
    const next = [...shape.vertices];
    next[draggingIdx] = toShape(e.clientX, e.clientY);
    onChange({ ...shape, vertices: next });
  };

  const handlePointerUp = () => setDraggingIdx(null);

  const insertVertex = (afterIdx: number, midpoint: CustomVertex) => {
    const next = [...shape.vertices];
    next.splice(afterIdx + 1, 0, midpoint);
    onChange({ ...shape, vertices: next });
    setSelectedIdx(afterIdx + 1);
  };

  const removeSelected = () => {
    if (selectedIdx === null || shape.vertices.length <= 3) return;
    const next = shape.vertices.filter((_, i) => i !== selectedIdx);
    onChange({ ...shape, vertices: next });
    setSelectedIdx(null);
  };

  const polygonPath =
    shape.vertices.length >= 3
      ? `M ${shape.vertices
          .map((v) => {
            const p = toScreen(v);
            return `${p.x} ${p.y}`;
          })
          .join(' L ')} Z`
      : '';

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label="Custom shape editor"
        className="w-full max-w-sm mx-auto rounded border border-gray-200 bg-white touch-none dark:border-gray-700 dark:bg-gray-900"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <rect
          x={marginX}
          y={marginY}
          width={areaW}
          height={areaH}
          fill="#F9FAFB"
          stroke="#E5E7EB"
          strokeWidth="1"
        />

        {polygonPath && (
          <path
            d={polygonPath}
            fill="#F5F3FF"
            stroke="#7C3AED"
            strokeWidth="2"
            strokeLinejoin="round"
            fillOpacity="0.5"
          />
        )}

        {shape.vertices.length >= 3 &&
          shape.vertices.map((v, i) => {
            const next = shape.vertices[(i + 1) % shape.vertices.length];
            const mid: CustomVertex = { x: (v.x + next.x) / 2, y: (v.y + next.y) / 2 };
            const sp = toScreen(mid);
            return (
              <circle
                key={`edge-${i}`}
                cx={sp.x}
                cy={sp.y}
                r="5"
                fill="#FFFFFF"
                stroke="#A78BFA"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                cursor="copy"
                onClick={() => insertVertex(i, mid)}
                aria-label={`Add vertex between vertex ${i + 1} and ${(i + 1) % shape.vertices.length + 1}`}
              >
                <title>Click to add a vertex here</title>
              </circle>
            );
          })}

        {shape.vertices.map((v, i) => {
          const sp = toScreen(v);
          const isSelected = selectedIdx === i;
          return (
            <circle
              key={`v-${i}`}
              cx={sp.x}
              cy={sp.y}
              r={isSelected ? 8 : 6}
              fill={isSelected ? '#7C3AED' : '#FFFFFF'}
              stroke="#7C3AED"
              strokeWidth="2"
              cursor="grab"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingIdx(i);
                setSelectedIdx(i);
              }}
              aria-label={`Vertex ${i + 1}${isSelected ? ' (selected)' : ''}`}
            >
              <title>Vertex {i + 1} — drag to move</title>
            </circle>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          {shape.vertices.length} vertices
        </span>
        {selectedIdx !== null && shape.vertices.length > 3 && (
          <button
            type="button"
            onClick={removeSelected}
            className="rounded border border-red-300 px-2 py-1 font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            Remove vertex {selectedIdx + 1}
          </button>
        )}
        <span className="ml-auto text-gray-500 dark:text-gray-400">
          Drag dots to move • Click between dots to add
        </span>
      </div>
    </div>
  );
}
