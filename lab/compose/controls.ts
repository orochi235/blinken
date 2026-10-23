import type {
  ChoiceParam,
  ColorsParam,
  NumberParam,
  Order,
  OrderBy,
  Param,
  ParamValue,
} from '@/index.js';

/** An element of `tag` with `cls`, holding `children`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...children);
  return e;
}

/** Options for a `<select>`, each a value shown as itself, `chosen` selected. */
export function options(select: HTMLSelectElement, values: readonly string[], chosen?: string) {
  for (const v of values) {
    const o = h('option', undefined, v);
    o.value = v;
    if (v === chosen) o.selected = true;
    select.append(o);
  }
}

const decimals = (step: number) => {
  const s = String(step);
  return s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
};

const hexOf = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** A control's row: its name, then the input, then a readout or the input's extras. */
function row(name: string, unit: string | undefined, ...rest: Node[]): HTMLElement {
  const label = h('span', 'ctl-name', name);
  if (unit) label.append(' ', h('small', undefined, unit));
  return h('label', 'ctl', label, ...rest);
}

/** A slider over a NumberParam's range, its value in a fixed-width cell after it. */
export function numberControl(
  param: NumberParam,
  value: number,
  onChange: (v: number) => void,
): HTMLElement {
  const input = h('input');
  input.type = 'range';
  input.min = String(param.min);
  input.max = String(param.max);
  input.step = String(param.step);
  input.value = String(value);
  const places = decimals(param.step);
  const out = h('output', 'readout', value.toFixed(places));
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.value = v.toFixed(places);
    onChange(v);
  });
  return row(param.label, param.unit, input, out);
}

function choiceControl(param: ChoiceParam, value: string, onChange: (v: string) => void) {
  const select = h('select');
  options(select, param.choices, value);
  select.addEventListener('change', () => onChange(select.value));
  return row(param.label, undefined, select);
}

function colorsControl(
  param: ColorsParam,
  value: readonly number[],
  onChange: (v: readonly number[]) => void,
) {
  let colors = [...value];
  const swatches = h('span', 'swatches');
  const add = h('button', 'small', '+');
  const remove = h('button', 'small', '−');
  add.type = remove.type = 'button';
  add.title = 'add a color';
  remove.title = 'remove the last color';
  const set = (next: number[]) => {
    colors = next;
    draw();
    onChange(colors);
  };
  const draw = () => {
    swatches.replaceChildren(
      ...colors.map((c, i) => {
        const input = h('input');
        input.type = 'color';
        input.value = hexOf(c);
        input.addEventListener('input', () => {
          colors[i] = Number.parseInt(input.value.slice(1), 16);
          onChange([...colors]);
        });
        return input;
      }),
    );
    remove.disabled = colors.length <= 1;
  };
  add.addEventListener('click', () => set([...colors, colors.at(-1) ?? 0xffffff]));
  remove.addEventListener('click', () => set(colors.slice(0, -1)));
  draw();
  return row(param.label, undefined, swatches, h('span', 'ctl-buttons', add, remove));
}

/** A control for one setting, built from its Param: a slider, a select or a list of colors. */
export function controlFor(
  key: string,
  param: Param,
  value: ParamValue,
  onChange: (v: ParamValue) => void,
): HTMLElement {
  const el =
    'colors' in param
      ? colorsControl(param, value as readonly number[], onChange)
      : 'choices' in param
        ? choiceControl(param, value as string, onChange)
        : numberControl(param, value as number, onChange);
  el.dataset.key = key;
  return el;
}

// A record, so a new OrderBy fails to compile until it is listed here.
const BY: Record<OrderBy, true> = {
  together: true,
  column: true,
  'column-reverse': true,
  center: true,
  row: true,
  letter: true,
  random: true,
};
const ORDERS = Object.keys(BY) as OrderBy[];

const LAG: NumberParam = { label: 'lag', min: 0, max: 400, step: 1, value: 0, unit: 'ms' };

/**
 * An order's controls: which order, and with `lag` its delay per rank. With `none`, a first
 * choice of "none" gives undefined.
 */
export function orderControls(
  label: string,
  order: Order | undefined,
  onChange: (o: Order | undefined) => void,
  { lag = true, none = false } = {},
): HTMLElement[] {
  let now = order;
  const select = h('select');
  if (none) options(select, ['none'], 'none');
  options(select, ORDERS, order?.by ?? (none ? 'none' : 'together'));
  const lagRow = numberControl(LAG, order?.lag ?? 0, (v) => {
    now = { ...(now ?? { by: 'together' }), lag: v };
    onChange(now);
  });
  const sync = () => lagRow.classList.toggle('off', select.value === 'none');
  select.addEventListener('change', () => {
    now = select.value === 'none' ? undefined : { ...now, by: select.value as OrderBy };
    sync();
    onChange(now);
  });
  sync();
  return lag ? [row(label, undefined, select), lagRow] : [row(label, undefined, select)];
}
