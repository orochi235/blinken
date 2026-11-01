import { type Board, frameOf, type Grid } from '@/index.js';
import { type Brush, reachOf, type Stamp } from './model.js';
import { stampBox } from './stamps.js';

/** What the overlay marks: the brush where the pointer is, and the stamps to pick up. */
export interface Marks {
  /** The pointer, in pitches, or null while it is off the board. */
  pointer: [number, number] | null;
  /** The dot a size-1 brush would paint, in pitches. */
  nearest: [number, number] | null;
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
  grid: Grid,
) {
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
    const { x, y, cols, rows } = stampBox(s);
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
      const [x, y] = px(m.nearest);
      ctx.beginPath();
      ctx.arc(x, y, r + line, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    const [x, y] = px(m.pointer);
    const reach = reachOf(size) * scale + r;
    const thin = r + line;
    ctx.beginPath();
    if (shape === 'round') ctx.arc(x, y, reach, 0, Math.PI * 2);
    else if (shape === 'square') ctx.rect(x - reach, y - reach, reach * 2, reach * 2);
    else if (shape === 'row') ctx.rect(x - reach, y - thin, reach * 2, thin * 2);
    else if (shape === 'column') ctx.rect(x - thin, y - reach, thin * 2, reach * 2);
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
