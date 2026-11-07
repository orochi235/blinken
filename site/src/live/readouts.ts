// ---
import {
  createOverlay,
  type Readout,
  type TransitionName,
  TYPES,
  type TypeName,
} from '@msb235/blinken';
import { onHold } from './kit';

/** Each instrument on the console: what it reads, on which type, and how many columns it spans. */
const GAUGES = {
  depth: { label: 'Depth · m', type: 'nixie', cells: 4, color: 0xff7a2a, span: 2 },
  status: {
    label: 'Status',
    type: 'fourteen',
    cells: 9,
    color: 0x4fd8ff,
    span: 2,
    transition: 'flap',
  },
  heading: { label: 'Heading', type: 'seven', cells: 3, color: 0xffb020, span: 1 },
  speed: { label: 'Speed · kn', type: 'seven', cells: 3, color: 0xffb020, span: 1 },
  water: { label: 'Water · °C', type: 'seven', cells: 3, color: 0xffb020, span: 1 },
  sonar: {
    label: 'Contacts',
    type: 'matrix',
    cells: 2,
    color: 0x6dff5a,
    span: 1,
    transition: 'count',
  },
  oxygen: { label: 'O₂', type: 'bargraph', cells: 16, color: 0x6dff5a, span: 2 },
  ballast: { label: 'Ballast', type: 'bargraph', cells: 16, color: 0xffb020, span: 2 },
  log: {
    label: 'Log',
    type: 'twentytwo',
    cells: 18,
    color: 0xe8e4dc,
    span: 4,
    transition: 'scramble',
  },
} as const satisfies Record<
  string,
  {
    label: string;
    type: TypeName;
    cells: number;
    color: number;
    span: number;
    transition?: TransitionName;
  }
>;

type Gauge = keyof typeof GAUGES;
type Order = 'dive' | 'hold' | 'surface';

export default function run(root: HTMLElement) {
  const panel = document.createElement('div');
  panel.className = 'console';
  root.append(panel);

  const overlay = createOverlay();
  const show = {} as Record<Gauge, Readout>;
  for (const [name, g] of Object.entries(GAUGES) as [Gauge, (typeof GAUGES)[Gauge]][]) {
    const bezel = document.createElement('figure');
    bezel.style.setProperty('--span', String(g.span));
    const glass = document.createElement('div');
    const slot = document.createElement('div');
    const { width, height } = TYPES[g.type].cell;
    slot.style.setProperty('--aspect', `${width * g.cells} / ${height}`);
    glass.append(slot);
    const caption = document.createElement('figcaption');
    caption.textContent = g.label;
    bezel.append(glass, caption);
    panel.append(bezel);
    show[name] = overlay.readout({
      type: g.type,
      cells: g.cells,
      color: g.color,
      follow: slot,
      transition: 'transition' in g ? g.transition : undefined,
    });
  }

  const orders = document.createElement('div');
  orders.className = 'console-orders';
  panel.append(orders);
  const buttons = (['dive', 'hold', 'surface'] as const).map((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o;
    b.addEventListener('click', () => command(o));
    orders.append(b);
    return b;
  });

  // The dive: depth in meters, speed in knots down (negative is up), oxygen 0 to 1.
  let order: Order = 'dive';
  let depth = 0;
  let speed = 0;
  let oxygen = 1;
  let heading = 274;
  let contacts = 0;
  let clock = 0;
  const command = (o: Order) => {
    order = o;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.textContent === o));
    show.log.set(
      { dive: 'Flooding tanks', hold: 'Trimming to neutral', surface: 'Blowing ballast' }[o],
    );
  };
  command('dive');

  const step = () => {
    clock += 0.1;
    const want = order === 'dive' ? 3 : order === 'surface' ? -2.5 : 0;
    speed += (want - speed) * 0.04;
    depth = Math.min(3000, Math.max(0, depth + speed * 2.5));
    if (depth === 3000 && order === 'dive') command('hold');
    if (depth === 0 && order === 'surface' && speed !== 0) {
      speed = 0;
      show.log.set('On the surface');
    }
    oxygen = depth === 0 ? Math.min(1, oxygen + 0.01) : Math.max(0, oxygen - 0.0004);
    heading = (heading + Math.sin(clock / 7) * 0.3 + 360) % 360;
    if (Math.random() < 0.01)
      contacts = Math.max(0, Math.min(9, contacts + (Math.random() < 0.5 ? -1 : 1)));

    const status =
      depth === 0 ? 'SURFACED' : { dive: 'DIVING', hold: 'HOLDING', surface: 'ASCENDING' }[order];
    show.depth.set(Math.round(depth));
    show.status.set(status);
    show.heading.set(String(Math.round(heading) % 360).padStart(3, '0'));
    show.speed.set(Math.abs(speed).toFixed(1));
    show.water.set((4 + 18 * Math.exp(-depth / 200)).toFixed(1));
    show.sonar.set(`0${contacts}`);
    show.oxygen.set(oxygen);
    show.ballast.set(order === 'dive' ? 1 : order === 'hold' ? 0.5 : 0);
  };
  step();

  let timer = 0;
  const stop = onHold(root, (paused) => {
    clearInterval(timer);
    if (!paused) timer = window.setInterval(step, 100);
  });
  return () => {
    stop();
    clearInterval(timer);
    overlay.destroy();
  };
}
