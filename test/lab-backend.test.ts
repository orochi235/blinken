import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Gpu } from '@/index.js';
import { choiceOn, drawWith, usesGpu } from '../lab/backend.js';
import { BACKEND, loadChoice, saveChoice } from '../lab/compose/storage.js';

const handle = { device: {} } as unknown as Gpu;

describe('drawWith', () => {
  it('gives auto the handle and leaves the backend to the sign', () => {
    expect(drawWith('auto', handle)).toEqual({ gpu: handle });
  });

  it('forces WebGPU when asked for it by name', () => {
    expect(drawWith('webgpu', handle)).toEqual({ gpu: handle, backend: 'webgpu' });
  });

  it('reads WebGPU without a handle as auto', () => {
    expect(drawWith('webgpu', null)).toEqual({});
    expect(drawWith('auto', null)).toEqual({});
  });

  it('names WebGL and 2D without passing a handle on', () => {
    expect(drawWith('webgl', handle)).toEqual({ backend: 'webgl' });
    expect(drawWith('2d', null)).toEqual({ backend: '2d' });
  });
});

describe('choiceOn', () => {
  it('shows WebGPU as auto once the page is known to have none, and waits until then', () => {
    expect(choiceOn('webgpu', null)).toBe('auto');
    expect(choiceOn('webgpu', undefined)).toBe('webgpu');
    expect(choiceOn('webgpu', handle)).toBe('webgpu');
    expect(choiceOn('webgl', null)).toBe('webgl');
  });

  it('has only auto and WebGPU wait on the handle', () => {
    expect(['auto', 'webgpu', 'webgl', '2d'].map((c) => usesGpu(c as never))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe('loadChoice and saveChoice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const storage = () => {
    const kept = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => void kept.set(k, v),
    });
    return kept;
  };

  it('keeps a choice and reads it back', () => {
    const kept = storage();
    saveChoice('webgl');
    expect(kept.get(BACKEND)).toBe('webgl');
    expect(loadChoice()).toBe('webgl');
  });

  it('reads auto when nothing, or something unknown, was kept', () => {
    const kept = storage();
    expect(loadChoice()).toBe('auto');
    kept.set(BACKEND, 'vulkan');
    expect(loadChoice()).toBe('auto');
  });

  it('reads auto and keeps nothing without storage', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(() => saveChoice('2d')).not.toThrow();
    expect(loadChoice()).toBe('auto');
  });
});
