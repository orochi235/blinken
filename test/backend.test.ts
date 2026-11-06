import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickBackend, webglSlot } from '@/render/backend.js';
import { gpu } from '@/render/gpu.js';

const handle = { device: {}, format: 'bgra8unorm', lost: new Promise<void>(() => {}) } as never;

describe('pickBackend', () => {
  it('lets an explicit choice win', () => {
    expect(pickBackend('2d', handle, () => true)).toBe('2d');
    expect(pickBackend('webgl', handle, () => false)).toBe('webgl');
    expect(pickBackend('webgpu', handle, () => false)).toBe('webgpu');
  });

  it('refuses webgpu without a handle', () => {
    expect(() => pickBackend('webgpu', null, () => true)).toThrow(
      "blinken: backend 'webgpu' needs a gpu handle",
    );
    expect(() => pickBackend('webgpu', undefined, () => true)).toThrow(/needs a gpu handle/);
  });

  it('takes webgpu when given a handle', () => {
    expect(pickBackend(undefined, handle, () => true)).toBe('webgpu');
  });

  it('falls to webgl, then 2d', () => {
    expect(pickBackend(undefined, null, () => true)).toBe('webgl');
    expect(pickBackend(undefined, undefined, () => false)).toBe('2d');
  });
});

describe('webglSlot', () => {
  it('hands out 12 slots, then none until one is released', () => {
    const held = Array.from({ length: 12 }, () => webglSlot());
    expect(held.every((r) => r !== null)).toBe(true);
    expect(webglSlot()).toBeNull();
    held[0]?.();
    const again = webglSlot();
    expect(again).not.toBeNull();
    again?.();
    for (const r of held) r?.();
  });

  it('frees only one slot when a release is called twice', () => {
    const held = Array.from({ length: 12 }, () => webglSlot());
    held[0]?.();
    held[0]?.();
    const a = webglSlot();
    expect(a).not.toBeNull();
    expect(webglSlot()).toBeNull();
    a?.();
    for (const r of held) r?.();
  });
});

describe('gpu', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is null without navigator.gpu', async () => {
    vi.stubGlobal('navigator', {});
    expect(await gpu()).toBeNull();
  });

  it('is null without an adapter', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => null } });
    expect(await gpu()).toBeNull();
  });

  it('is null when requestDevice rejects', async () => {
    const adapter = { requestDevice: async () => Promise.reject(new Error('no')) };
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => adapter } });
    expect(await gpu()).toBeNull();
  });

  it('returns the device, the preferred format, and a lost promise that resolves', async () => {
    const device = { lost: Promise.resolve({ reason: 'destroyed' }) };
    const adapter = { requestDevice: async () => device };
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: async () => adapter, getPreferredCanvasFormat: () => 'rgba8unorm' },
    });
    const g = await gpu();
    expect(g?.device).toBe(device);
    expect(g?.format).toBe('rgba8unorm');
    await expect(g?.lost).resolves.toBeUndefined();
  });
});
