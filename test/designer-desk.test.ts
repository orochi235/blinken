import { describe, expect, it } from 'vitest';
import { designer } from '../lab/compose/designer/open.js';

describe("the designer's desk", () => {
  it('keeps a picked id, and drops it when another effect opens', () => {
    designer.setOpen('fall');
    designer.setPicked('piece:active:1');
    expect(designer.picked()).toBe('piece:active:1');
    designer.setOpen('scroll');
    expect(designer.picked()).toBeUndefined();
  });
});
