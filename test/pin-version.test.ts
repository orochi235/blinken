import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PINNED, pin, VERSION } from '../scripts/pin-version.mjs';

describe('pinned versions', () => {
  it('the README names the package at its own version', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const named = readme.match(PINNED) ?? [];
    expect(named.length).toBeGreaterThan(0);
    expect(new Set(named)).toEqual(new Set([`@msb235/blinken@${VERSION}`]));
  });

  it('pins every reference and leaves the unversioned name alone', () => {
    expect(pin('npm i @msb235/blinken@0.1.0 or @msb235/blinken', '1.2.3')).toBe(
      'npm i @msb235/blinken@1.2.3 or @msb235/blinken',
    );
  });
});
