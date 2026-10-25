import { Input } from '@weasel-js/ui';
import {
  type EffectParam,
  type EffectSpec,
  MODULATORS,
  MOVES,
  type Piece,
  piecesOf,
  SLOTS,
  sameKind,
  targetOf,
} from '@/index.js';
import { IconButton } from '../IconButton.js';
import { PlainSelect } from '../PlainSelect.js';
import { editEffect } from './edit.js';
import './ParamsBox.css';

const nameOf = (piece: Piece) => ('mod' in piece ? piece.mod : piece.move);

/** Every number setting of `spec` a param can drive, as its path and how the designer names it. */
function targetsOf(spec: EffectSpec): { path: string; label: string }[] {
  const out: { path: string; label: string }[] = [];
  if (spec.order) out.push({ path: 'lag', label: 'whole effect lag' });
  out.push({ path: 'blend', label: 'blend' });
  for (const slot of SLOTS)
    piecesOf(spec[slot]).forEach((piece, i) => {
      const head = `${slot} ${nameOf(piece)}`;
      out.push({
        path: `${slot}.${i}.lag`,
        label: `${head} ${'mod' in piece ? 'spread' : 'order'} lag`,
      });
      const thing = 'mod' in piece ? MODULATORS[piece.mod] : MOVES[piece.move];
      for (const [key, p] of Object.entries(thing.params))
        out.push({ path: `${slot}.${i}.${key}`, label: `${head} ${p.label}` });
    });
  return out.filter((t) => targetOf(spec, t.path));
}

/** Whether `path` takes the same values as the setting `p` drives first, so `p` can drive it too. */
const fitsWith = (spec: EffectSpec, p: EffectParam, path: string) => {
  const first = p.to[0] === undefined ? undefined : targetOf(spec, p.to[0]);
  const it = targetOf(spec, path);
  return !first || (it !== undefined && sameKind(first.param, it.param));
};

/** `base`, or `base 2`, `base 3`… : the first name `taken` lacks. */
const freeName = (base: string, taken: Readonly<Record<string, unknown>>) => {
  let name = base;
  for (let n = 2; Object.hasOwn(taken, name) || name === '__proto__'; n++) name = `${base} ${n}`;
  return name;
};

/** `spec` with param `name` replaced by `fn` of it. */
const withParam = (spec: EffectSpec, name: string, fn: (p: EffectParam) => EffectParam) => {
  const p = spec.params?.[name];
  return p ? { ...spec, params: { ...spec.params, [name]: fn(p) } } : spec;
};

/** What a scene playing the open effect can tune: each param, its words, and what it drives. */
export function ParamsBox({ spec }: { spec: EffectSpec }) {
  const targets = targetsOf(spec);
  const params = Object.entries(spec.params ?? {});
  return (
    <section className="compose-slot compose-params" aria-label="params">
      <h3 className="compose-heading">params</h3>
      {params.length === 0 && (
        <p className="compose-hint">
          Nothing here for a scene to tune but blend and lag. Add a param to offer one of the
          pieces’ settings, under a name of its own.
        </p>
      )}
      {params.map(([name, p]) => (
        <div key={name} className="compose-param">
          <div className="compose-param-head">
            <span className="compose-param-name" title="What a scene sets this param by.">
              {name}
            </span>
            <span title="What the scene panel calls this param.">
              <Input
                aria-label={`${name} label`}
                value={p.label}
                onChange={(label) =>
                  editEffect((e) => withParam(e, name, (q) => ({ ...q, label })))
                }
              />
            </span>
            <IconButton
              glyph="remove"
              label="stop offering this param; scenes that set it play the effect’s own value"
              onClick={() =>
                editEffect((e) => {
                  const { [name]: _, ...rest } = e.params ?? {};
                  const { params: __, ...bare } = e;
                  return Object.keys(rest).length ? { ...bare, params: rest } : bare;
                })
              }
            />
          </div>
          <span title="The param’s tooltip in the scene panel: what it does, in plain words.">
            <Input
              aria-label={`${name} about`}
              placeholder="what it does"
              value={p.about}
              onChange={(about) => editEffect((e) => withParam(e, name, (q) => ({ ...q, about })))}
            />
          </span>
          <fieldset className="compose-param-targets">
            <legend
              className="compose-about"
              title="A scene setting this param writes its value into every setting ticked here. The control the scene sees, its range and its starting value come from the first one ticked; only settings of that kind are listed."
            >
              changes these settings
            </legend>
            {targets
              .filter((t) => fitsWith(spec, p, t.path))
              .map((t) => (
                <label key={t.path} className="compose-check">
                  <input
                    type="checkbox"
                    checked={p.to.includes(t.path)}
                    // The last setting stays: a param that drives nothing is no param.
                    disabled={p.to.length === 1 && p.to[0] === t.path}
                    onChange={(e) => {
                      const on = e.target.checked;
                      editEffect((spec) =>
                        withParam(spec, name, (q) => ({
                          ...q,
                          to: on ? [...q.to, t.path] : q.to.filter((x) => x !== t.path),
                        })),
                      );
                    }}
                  />
                  {t.label}
                </label>
              ))}
          </fieldset>
        </div>
      ))}
      <PlainSelect
        aria-label="add a param"
        placeholder="add a param for…"
        options={[
          { title: 'settings', options: targets.map((t) => ({ value: t.path, label: t.label })) },
        ]}
        selectedKey={null}
        onSelectionChange={(path) => {
          if (!path) return;
          editEffect((e) => {
            const target = targetOf(e, path);
            if (!target) return e;
            const name = freeName(target.param.label, e.params ?? {});
            const param = { label: name, about: target.param.about, to: [path] };
            return { ...e, params: { ...e.params, [name]: param } };
          });
        }}
      />
    </section>
  );
}
