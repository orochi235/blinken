import '@weasel-js/labkit/styles.css';
import { IconRegistryProvider } from '@weasel-js/core';
import { LabShell } from '@weasel-js/labkit';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { PAGES } from '../pages.js';
import { controlHistory } from './controls.js';
import { UndoBar } from './UndoBar.js';

/** Puts nodes made outside React into the tree, moved rather than copied. */
function Adopted({ nodes, className }: { nodes: readonly Node[]; className: string }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    box.current?.append(...nodes);
  }, [nodes]);
  return <div ref={box} className={className} />;
}

/**
 * Frames a page written as plain HTML in the lab's shell: its title as the page switcher, undo and
 * redo over its controls, and what `#root` held as the body, in a `.lab-page`. Synchronous, so the
 * page's own script finds every element by id as soon as this returns.
 */
export function adoptShell(title: string): void {
  const root = document.getElementById('root') as HTMLElement;
  const nodes = [...root.childNodes];
  root.replaceChildren();
  const history = controlHistory(root);
  flushSync(() =>
    createRoot(root).render(
      <IconRegistryProvider icons={kitIcons}>
        <LabShell title={title} mode="dark" pages={PAGES} header={<UndoBar target={history} />}>
          <Adopted nodes={nodes} className="lab-page" />
        </LabShell>
      </IconRegistryProvider>,
    ),
  );
}
