import { EFFECTS, type Step } from '@/index.js';
import { AMBER } from '../demo.js';
import { h, hexOf, numberControl } from './controls.js';
import { type ComposeState, HOLD, moveStep } from './state.js';

/** What the program list tells the page: a step was edited, picked, or the list reshaped. */
export interface ProgramEvents {
  /** Step `at` changed; the list itself is unchanged. */
  edit(at: number): void;
  /** `state.editing.step` is a different step now, or the steps moved under it. */
  select(): void;
  /** Loop the picked step alone, or the whole program. */
  solo(on: boolean): void;
  restart(): void;
}

/**
 * The program as a list of steps, each with its text, color, effect and an optional hold of its
 * own. `render` redraws it after the effects change.
 */
export function mountProgram(
  root: HTMLElement,
  state: ComposeState,
  on: ProgramEvents,
): { render(): void } {
  const picked = () => state.editing.step ?? 0;

  // Every write reads the step as it stands now: edits made without a redraw leave a card stale.
  const edit = (i: number, fn: (s: Step) => Step) => {
    const step = state.program[i];
    if (!step) return;
    state.program[i] = fn(step);
    on.edit(i);
  };

  /** Reshapes the list, keeping the picked step picked wherever it lands. */
  const reshape = (next: Step[], pick?: Step) => {
    const keep = pick ?? state.program[picked()];
    state.program = next;
    const at = keep ? next.indexOf(keep) : -1;
    state.editing.step = at >= 0 ? at : Math.min(picked(), next.length - 1);
    render();
    on.select();
  };

  const effectSelect = (chosen: string) => {
    const select = h('select');
    const group = (label: string, names: readonly string[]) => {
      if (!names.length) return;
      const g = h('optgroup');
      g.label = label;
      for (const n of names) {
        const o = h('option', undefined, n);
        o.value = n;
        o.selected = n === chosen;
        g.append(o);
      }
      select.append(g);
    };
    group('yours', Object.keys(state.effects));
    group('built-in', Object.keys(EFFECTS));
    return select;
  };

  const card = (step: Step, i: number) => {
    const pick = h('input');
    pick.type = 'radio';
    pick.name = 'step';
    pick.checked = i === picked();
    pick.title = 'edit this step';
    pick.addEventListener('change', () => {
      state.editing.step = i;
      for (const [j, el] of [...root.querySelectorAll('.step')].entries())
        el.classList.toggle('on', j === i);
      on.select();
    });

    const text = h('input', 'step-text');
    text.type = 'text';
    text.value = step.text;
    text.addEventListener('input', () => edit(i, (s) => ({ ...s, text: text.value || ' ' })));

    const color = h('input');
    color.type = 'color';
    color.value = hexOf(step.hex);
    color.addEventListener('input', () =>
      edit(i, (s) => ({ ...s, hex: Number.parseInt(color.value.slice(1), 16) })),
    );

    const effect = effectSelect(typeof step.effect === 'string' ? step.effect : '');
    effect.addEventListener('change', () => {
      edit(i, (s) => ({ ...s, effect: effect.value }));
      if (i === picked()) on.select();
    });

    const hold = numberControl(HOLD, step.hold ?? 3000, (v) => edit(i, (s) => ({ ...s, hold: v })));
    const slider = hold.querySelector('input') as HTMLInputElement;
    const own = h('input');
    own.type = 'checkbox';
    own.checked = step.hold !== undefined;
    own.title = 'hold this step for a time of its own, not its effect’s';
    const sync = () => {
      slider.disabled = !own.checked;
      hold.classList.toggle('dim', !own.checked);
    };
    own.addEventListener('change', () => {
      sync();
      edit(i, ({ hold: _, ...s }) => (own.checked ? { ...s, hold: Number(slider.value) } : s));
    });
    sync();

    const button = (label: string, title: string, act: () => void, off = false) => {
      const b = h('button', 'small', label);
      b.type = 'button';
      b.title = title;
      b.disabled = off;
      b.addEventListener('click', act);
      return b;
    };
    const last = state.program.length - 1;
    const tools = h(
      'div',
      'step-tools',
      h('label', 'step-own', own, 'own hold'),
      button('up', 'move this step up', () => reshape(moveStep(state.program, i, -1)), i === 0),
      button(
        'down',
        'move this step down',
        () => reshape(moveStep(state.program, i, 1)),
        i === last,
      ),
      button(
        'remove',
        'remove this step',
        () => reshape(state.program.filter((_, j) => j !== i)),
        last === 0,
      ),
    );

    const el = h(
      'div',
      `step${i === picked() ? ' on' : ''}`,
      h('div', 'step-head', pick, text, color, effect),
      tools,
      hold,
    );
    return el;
  };

  const add = h('button', 'small', 'add step');
  add.type = 'button';
  add.addEventListener('click', () => {
    const fresh: Step = { text: 'NEW', hex: AMBER, effect: 'hold' };
    const at = picked() + 1;
    reshape([...state.program.slice(0, at), fresh, ...state.program.slice(at)], fresh);
  });
  const solo = h('input');
  solo.type = 'checkbox';
  solo.addEventListener('change', () => on.solo(solo.checked));
  const restart = h('button', 'small', 'restart');
  restart.type = 'button';
  restart.title = 'play again from the step being edited';
  restart.addEventListener('click', () => on.restart());
  const head = h(
    'header',
    'pane-head',
    h('h2', undefined, 'program'),
    add,
    h('label', 'step-own', solo, 'solo'),
    restart,
  );
  head.querySelector('label')?.setAttribute('title', 'loop the step being edited alone');
  const list = h('div', 'steps');

  const render = () => list.replaceChildren(...state.program.map(card));
  root.replaceChildren(head, list);
  render();
  return { render };
}
