import { Button } from '@weasel-js/labkit';
import { useState } from 'react';
import { STEP_SEQUENCE, type TransitionRecipe } from '@/index.js';
import { codeOf } from './code.js';
import { EASINGS, MOVES, ORDERS, transitions } from './store.js';

const MOVE_NOTES: Record<TransitionRecipe['move'], string> = {
  cut: 'Each cell changes as its turn starts.',
  fade: 'Old lights dim as new ones brighten.',
  step: 'Each cell passes through the characters between, in this order.',
  scramble: 'Each cell flickers through random characters, then lands.',
  count: 'A number shows the numbers between, all at once; anything else fades.',
};

/** The open transition's settings, and the code that makes it. */
export function Editor({ recipe }: { recipe: TransitionRecipe }) {
  const [copied, setCopied] = useState(false);
  const builtIn = transitions.isBuiltIn(recipe.name);
  const edit = (change: Partial<TransitionRecipe>, run?: string) => transitions.edit(change, run);
  const code = codeOf(recipe);
  return (
    <div className="tr-editor">
      {builtIn && <p className="tr-note">A built-in: changing it saves a copy.</p>}
      <label className="tr-field">
        name
        <input
          key={recipe.name}
          defaultValue={recipe.name}
          disabled={builtIn}
          onBlur={(e) => edit({ name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
      <label className="tr-field">
        ms
        <input
          type="number"
          min={0}
          max={10000}
          step={50}
          value={recipe.ms}
          onChange={(e) => edit({ ms: Math.max(0, Number(e.target.value) || 0) }, 'ms')}
        />
      </label>
      <label className="tr-field">
        move
        <select
          value={recipe.move}
          onChange={(e) => edit({ move: e.target.value as TransitionRecipe['move'] })}
        >
          {MOVES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <p className="tr-note">{MOVE_NOTES[recipe.move]}</p>
      {recipe.move === 'step' && (
        <label className="tr-field tr-wide">
          through
          <input
            value={recipe.through ?? STEP_SEQUENCE}
            spellCheck={false}
            onChange={(e) => edit({ through: e.target.value }, 'through')}
          />
        </label>
      )}
      {recipe.move === 'scramble' && (
        <label className="tr-field">
          rolls
          <input
            type="number"
            min={1}
            max={100}
            value={recipe.rolls ?? 10}
            onChange={(e) => edit({ rolls: Math.max(1, Number(e.target.value) || 1) }, 'rolls')}
          />
        </label>
      )}
      {recipe.move !== 'count' && (
        <>
          <label className="tr-field">
            order
            <select
              value={recipe.order ?? 'left'}
              onChange={(e) => edit({ order: e.target.value as TransitionRecipe['order'] })}
            >
              {ORDERS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="tr-field">
            spread
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={recipe.spread ?? 0}
              onChange={(e) => edit({ spread: Number(e.target.value) }, 'spread')}
            />
            <output className="tr-value">{(recipe.spread ?? 0).toFixed(2)}</output>
          </label>
        </>
      )}
      <label className="tr-field">
        easing
        <select
          value={recipe.easing ?? 'linear'}
          onChange={(e) => edit({ easing: e.target.value as TransitionRecipe['easing'] })}
        >
          {EASINGS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <pre className="tr-code">{code}</pre>
      <Button
        size="sm"
        onClick={() => {
          navigator.clipboard
            ?.writeText(code)
            .then(() => setCopied(true))
            .catch(() => {});
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'copied' : 'copy as code'}
      </Button>
    </div>
  );
}
