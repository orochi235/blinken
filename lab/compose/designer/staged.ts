import { useMemo } from 'react';
import {
  board,
  type EffectSpec,
  placeText,
  SIZE,
  type Slot,
  type Stretch,
  stageEffect,
  type Warning,
} from '@/index.js';

/** The sign the designer stages on: the shopfront size. */
const BOARD = board(SIZE.cols, SIZE.rows);

/** The open effect staged on the preview text: where each part plays, and warnings by slot. */
export interface Staged {
  parts: Readonly<Record<Slot, Stretch>> | null;
  warnings: ReadonlyMap<Slot | 'effect', readonly string[]>;
}

/** Stages `spec` on `text`; a spec that throws has no parts and its message as an effect warning. */
export function stagedOf(spec: EffectSpec, text: string): Staged {
  const warnings = new Map<Slot | 'effect', string[]>();
  let found: readonly Warning[];
  let parts: Staged['parts'] = null;
  try {
    const staged = stageEffect(spec, placeText(BOARD, text || ' '), 0xffffff);
    found = staged.warnings;
    parts = staged.parts;
  } catch (e) {
    found = [{ text: (e as Error).message }];
  }
  for (const w of found.filter((w) => w.rows === undefined))
    warnings.set(w.slot ?? 'effect', [...(warnings.get(w.slot ?? 'effect') ?? []), w.text]);
  return { parts, warnings };
}

/** `stagedOf`, kept while the spec and text are the same. */
export const useStaged = (spec: EffectSpec | undefined, text: string): Staged | null =>
  useMemo(() => (spec ? stagedOf(spec, text) : null), [spec, text]);
