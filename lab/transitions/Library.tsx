import { Button } from '@weasel-js/labkit';
import { BUILT_INS, transitions, useTransitions } from './store.js';

/** The built-in transitions and the ones made here; picking one opens it. */
export function Library() {
  const { saved, open } = useTransitions();
  const item = (name: string) => (
    <li key={name}>
      <button
        type="button"
        className="tr-item"
        aria-current={name === open}
        onClick={() => transitions.open(name)}
      >
        {name}
      </button>
    </li>
  );
  return (
    <nav className="tr-library">
      <h2>built in</h2>
      <ul>{BUILT_INS.map(item)}</ul>
      <h2>yours</h2>
      {saved.length ? (
        <ul>{saved.map((r) => item(r.name))}</ul>
      ) : (
        <p className="tr-note">Change a built-in and it is saved here as a copy.</p>
      )}
      <div className="tr-library-actions">
        <Button size="sm" onClick={transitions.duplicate}>
          duplicate
        </Button>
        <Button size="sm" disabled={transitions.isBuiltIn(open)} onClick={transitions.remove}>
          delete
        </Button>
      </div>
    </nav>
  );
}
