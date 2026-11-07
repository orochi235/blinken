import type { Box, Glyph } from './glyphs.js';
import type { CellStyle } from './style.js';

/** `g` centered in `box`, `scale` CSS pixels to a device pixel. */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  g: Glyph,
  box: Box,
  style: CellStyle,
  scale: number,
) {
  if (typeof g !== 'string') {
    g.draw(ctx, box, style);
    return;
  }
  if (g.trim() === '') return;
  const px = box.h * style.size;
  ctx.font = `${style.weight} ${px}px ${style.font}`;
  ctx.fillStyle = style.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const wide = ctx.measureText(g).width;
  // A word wider than its card is squeezed to fit, as a printed card would be set narrow.
  const room = box.w - 4 * scale;
  const squeeze = wide > room ? room / wide : 1;
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2 + px * 0.04);
  ctx.scale(squeeze, 1);
  ctx.fillText(g, 0, 0);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, b: Box, r: number) {
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, Math.max(0, Math.min(r, b.w / 2, b.h / 2)));
}

/**
 * A reel at `pos`, a glyph index that may fall between two: the drum turns upward as `pos` grows,
 * its glyphs foreshortened and darkened toward the window's top and bottom.
 */
export function drawReel(
  ctx: CanvasRenderingContext2D,
  glyphs: readonly Glyph[],
  pos: number,
  box: Box,
  style: CellStyle,
  scale: number,
) {
  const n = glyphs.length;
  ctx.save();
  roundRect(ctx, box, style.radius * scale);
  ctx.fillStyle = style.face;
  ctx.fill();
  ctx.clip();
  // The window shows one glyph and `peek` of each neighbor: the drum's half-turn spans that much.
  const pitch = box.h / (1 + 2 * style.peek);
  const radius = box.h / 2;
  const mid = box.y + box.h / 2;
  for (let j = Math.floor(pos) - 2; j <= Math.floor(pos) + 3; j++) {
    const arc = ((j - pos) * pitch) / radius;
    if (Math.abs(arc) >= Math.PI / 2) continue;
    const g = glyphs[((j % n) + n) % n] as Glyph;
    const y = mid + radius * Math.sin(arc);
    const squash = Math.cos(arc);
    ctx.save();
    ctx.translate(0, y);
    ctx.scale(1, squash);
    drawGlyph(ctx, g, { x: box.x, y: -pitch / 2, w: box.w, h: pitch }, style, scale);
    ctx.restore();
  }
  if (style.shade > 0) {
    const fall = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    const edge = `rgba(0,0,0,${style.shade})`;
    fall.addColorStop(0, edge);
    fall.addColorStop(0.32, 'rgba(0,0,0,0)');
    fall.addColorStop(0.68, 'rgba(0,0,0,0)');
    fall.addColorStop(1, edge);
    ctx.fillStyle = fall;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.restore();
}

/** The half of `g`'s card above or below its hinge, drawn whole and clipped. */
function half(
  ctx: CanvasRenderingContext2D,
  g: Glyph,
  box: Box,
  top: boolean,
  style: CellStyle,
  scale: number,
) {
  const h = box.h / 2;
  const part = { x: box.x, y: top ? box.y : box.y + h, w: box.w, h };
  ctx.save();
  ctx.beginPath();
  ctx.rect(part.x, part.y, part.w, part.h);
  ctx.clip();
  roundRect(ctx, box, style.radius * scale);
  ctx.fillStyle = style.face;
  ctx.fill();
  drawGlyph(ctx, g, box, style, scale);
  ctx.restore();
}

/**
 * A flap turning from card `from` to card `to`, `phase` 0 to 1 through the fall: `to`'s top half
 * shows behind as `from`'s top half folds down to the hinge, then `to`'s bottom half folds down
 * over `from`'s.
 */
export function drawFlap(
  ctx: CanvasRenderingContext2D,
  from: Glyph,
  to: Glyph,
  phase: number,
  box: Box,
  style: CellStyle,
  scale: number,
) {
  const hinge = box.y + box.h / 2;
  const settled = phase >= 1 || from === to;
  half(ctx, to, box, true, style, scale);
  half(ctx, settled ? to : from, box, false, style, scale);
  if (!settled && phase > 0) {
    const fold = Math.cos(phase * Math.PI);
    const top = fold > 0;
    ctx.save();
    ctx.translate(0, hinge);
    ctx.scale(1, Math.abs(fold));
    ctx.translate(0, -hinge);
    half(ctx, top ? from : to, box, top, style, scale);
    if (style.shade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${style.shade * (1 - Math.abs(fold))})`;
      ctx.fillRect(box.x, top ? box.y : hinge, box.w, box.h / 2);
    }
    ctx.restore();
  }
  if (style.split) {
    ctx.fillStyle = style.split;
    ctx.fillRect(box.x, hinge - scale / 2, box.w, Math.max(1, scale));
  }
}
