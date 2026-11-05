import { type Board, frameOf, GRIDS, type GridName, TRI_H, triangleAt } from '@/index.js';
import { type Brush, reachOf, type Stamp } from './model.js';
import { stampBox } from './stamps.js';

/** What the overlay marks: the brush where the pointer is, and the stamps to pick up. */
export interface Marks {
  /** Where the brush is centered, in pitches, or null while the pointer is off the board. */
  pointer: [number, number] | null;
  /** The dot a size-1 brush would paint, in pitches. */
  nearest: [number, number] | null;
  /** That dot's column and row. */
  cell: readonly [number, number] | null;
  brush: Brush;
  stamps: readonly Stamp[];
  picked: string | null;
  /** A dot's radius, in pitches. */
  radius: number;
}

/**
 * A canvas laid over the sign's, drawing the brush's true outline at the pointer and, for the text
 * tool, a frame round each stamp.
 */
export function createOverlay(
  overlay: HTMLCanvasElement,
  sign: HTMLCanvasElement,
  b: Board,
  gridName: GridName,
) {
  const grid = GRIDS[gridName];
  const triangles = gridName === 'triangles';
  const ctx = overlay.getContext('2d') as CanvasRenderingContext2D;
  const frame = frameOf(b, grid);
  let scale = 1;

  function fit(): void {
    const r = sign.getBoundingClientRect();
    overlay.style.width = `${r.width}px`;
    overlay.style.height = `${r.height}px`;
    overlay.width = Math.round(r.width * devicePixelRatio);
    overlay.height = Math.round(r.height * devicePixelRatio);
    scale = overlay.width / frame.across;
  }
  const px = ([x, y]: readonly [number, number]): [number, number] => [
    (x - frame.left) * scale,
    (y - frame.top) * scale,
  ];

  function stampFrame(s: Stamp): [number, number][] {
    const { x, y, cols, rows } = stampBox(s, gridName);
    if (triangles) {
      // Its triangles' outer edges: k runs half a pitch at a time, and each triangle is a pitch wide.
      const [l, r] = [x / 2, (x + cols - 1) / 2 + 1];
      const [t, bt] = [y * TRI_H, (y + rows) * TRI_H];
      return [px([l, t]), px([r, t]), px([r, bt]), px([l, bt])];
    }
    const corners = [
      grid(x, y),
      grid(x + cols - 1, y),
      grid(x + cols - 1, y + rows - 1),
      grid(x, y + rows - 1),
    ];
    // Half a pitch out from the corner dots, along the grid's own axes so a hex frame leans too.
    const [ox, oy] = grid(0, 0);
    const [ax, ay] = grid(1, 0);
    const [dx, dy] = grid(0, 1);
    const across: [number, number] = [(ax - ox) / 2, (ay - oy) / 2];
    const down: [number, number] = [(dx - ox) / 2, (dy - oy) / 2];
    const signs: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    return corners.map(([cx, cy], i) => {
      const [sa, sd] = signs[i] as [number, number];
      return px([cx + sa * across[0] + sd * down[0], cy + sa * across[1] + sd * down[1]]);
    });
  }

  function draw(m: Marks): void {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const line = Math.max(1, devicePixelRatio);
    ctx.lineWidth = line;
    if (m.brush.tool === 'text') {
      for (const s of m.stamps) {
        ctx.setLineDash(s.id === m.picked ? [] : [4 * line, 4 * line]);
        ctx.strokeStyle = s.id === m.picked ? '#fffd' : '#fff6';
        ctx.beginPath();
        for (const [x, y] of stampFrame(s)) ctx.lineTo(x, y);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
      return;
    }
    if (!m.pointer) return;
    ctx.strokeStyle = m.brush.tool === 'erase' ? '#ff8080' : '#ffffffcc';
    const r = m.radius * scale;
    const { size, shape } = m.brush;
    if (size === 1) {
      if (!m.nearest) return;
      ctx.beginPath();
      if (triangles && m.cell) for (const c of triangleAt(...m.cell).corners) ctx.lineTo(...px(c));
      else ctx.arc(...px(m.nearest), r + line, 0, Math.PI * 2);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    const [x, y] = px(m.pointer);
    const reach = reachOf(size) * scale + r;
    const thin = r + line;
    // A triangle row or column brush keeps to the cell's own row, or its own pitch-wide column.
    const band = triangles ? m.cell : null;
    const top = band ? px([0, band[1] * TRI_H])[1] : y - thin;
    const left = band ? px([band[0] / 2, 0])[0] : x - thin;
    ctx.beginPath();
    if (shape === 'round') ctx.arc(x, y, reach, 0, Math.PI * 2);
    else if (shape === 'square') ctx.rect(x - reach, y - reach, reach * 2, reach * 2);
    else if (shape === 'row') ctx.rect(x - reach, top, reach * 2, band ? TRI_H * scale : thin * 2);
    else if (shape === 'column') ctx.rect(left, y - reach, band ? scale : thin * 2, reach * 2);
    else {
      // The diamond's corners reach as far as its dots do; its sides clear the dots along them.
      const tip = reachOf(size) * scale + r * Math.SQRT2;
      ctx.moveTo(x, y - tip);
      ctx.lineTo(x + tip, y);
      ctx.lineTo(x, y + tip);
      ctx.lineTo(x - tip, y);
      ctx.closePath();
    }
    ctx.stroke();
  }

  return { fit, draw };
}
