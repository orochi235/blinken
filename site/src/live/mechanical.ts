// ---
import { createMechanical, type DrawnGlyph, type Mechanical } from '@msb235/blinken/mechanical';
import { onHold } from './kit';

/** An arrow drawn rather than typed, pointing `turns` quarter turns clockwise from up. */
const arrow = (name: string, turns: number): DrawnGlyph => ({
  name,
  draw(ctx, box, style) {
    const s = Math.min(box.w, box.h) * 0.32;
    ctx.save();
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.fillStyle = style.ink;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.8, 0);
    ctx.lineTo(s * 0.3, 0);
    ctx.lineTo(s * 0.3, s);
    ctx.lineTo(-s * 0.3, s);
    ctx.lineTo(-s * 0.3, 0);
    ctx.lineTo(-s * 0.8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
});

const DEPARTURES = [
  ['LISBON', '0915', 'A3', 'ON TIME'],
  ['OSLO', '0940', 'B7', 'BOARDING'],
  ['PRAGUE', '1005', 'C1', 'DELAYED'],
  ['VALENCIA', '1030', 'A9', 'ON TIME'],
] as const;

export default function run(root: HTMLElement) {
  const canvas = (cls: string) => {
    const c = document.createElement('canvas');
    c.className = cls;
    root.append(c);
    return c;
  };

  // An odometer: white-on-black miles, and a last reel in red for tenths.
  const odometer = createMechanical(canvas('mech-odometer'), {
    kind: 'reel',
    cells: 7,
    value: '0012480',
    label: 'Odometer',
    each: { 6: { face: '#e8e2d4', ink: '#b3261e' } },
  });

  // A reel of any glyphs at all: words, and arrows that draw themselves.
  const heading = createMechanical(canvas('mech-heading'), {
    kind: 'reel',
    cells: 2,
    glyphs: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    each: {
      1: { glyphs: [arrow('N', 0), arrow('E', 1), arrow('S', 2), arrow('W', 3)], ink: '#ffb020' },
    },
    value: ['MON', 'N'],
    label: 'Day and heading',
    style: { size: 0.5 },
  });

  // A departures board: a row of flaps for each column, the time's colon a fixed card.
  const board = canvas('mech-board');
  const rows = DEPARTURES.map(() => {
    const row = document.createElement('div');
    row.className = 'mech-row';
    const make = (cls: string, cells: number, extra = {}) => {
      const c = document.createElement('canvas');
      c.className = cls;
      row.append(c);
      return createMechanical(c, { kind: 'flap', cells, ...extra });
    };
    const flaps = {
      city: make('mech-city', 9),
      time: make('mech-time', 5, {
        each: { 2: { glyphs: [':'] } },
        style: { ink: '#ffb020' },
      }),
      gate: make('mech-gate', 2),
      status: make('mech-status', 8, { style: { ink: '#7fd8ff' } }),
    };
    board.before(row);
    return flaps;
  });
  board.remove();

  let n = 0;
  let miles = 12480;
  const next = () => {
    miles += 7 + (n % 5);
    odometer.set(String(miles).padStart(7, '0'));
    heading.set([
      ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][n % 7] ?? 'MON',
      'NESW'[n % 4] ?? 'N',
    ]);
    for (const [i, r] of rows.entries()) {
      const [city, time, gate, status] = DEPARTURES[(i + n) % DEPARTURES.length] ?? DEPARTURES[0];
      r.city.set(city);
      r.time.set(`${time.slice(0, 2)}:${time.slice(2)}`);
      r.gate.set(gate);
      r.status.set(status);
    }
    n++;
  };
  next();

  let timer = 0;
  const stop = onHold(root, (paused) => {
    clearInterval(timer);
    if (!paused) timer = window.setInterval(next, 3500);
  });
  const all: Mechanical[] = [odometer, heading, ...rows.flatMap((r) => Object.values(r))];
  return () => {
    stop();
    clearInterval(timer);
    for (const m of all) m.destroy();
  };
}
