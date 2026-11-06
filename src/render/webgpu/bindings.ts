/** How a shader reaches a buffer: `uniform`, read-only storage, or storage it writes. */
export type Access = 'uniform' | 'read' | 'write';

/** A shader's buffers, binding 0 onward, each its WGSL name, access and type. */
export type Bindings = readonly (readonly [name: string, access: Access, type: string])[];

const SPACE: Record<Access, string> = {
  uniform: 'uniform',
  read: 'storage, read',
  write: 'storage, read_write',
};
const KIND: Record<Access, GPUBufferBindingType> = {
  uniform: 'uniform',
  read: 'read-only-storage',
  write: 'storage',
};
/** `GPUShaderStage.COMPUTE`, which Node has no global for. */
const COMPUTE = 4;

/** `list`'s declarations in group 0, as WGSL. */
export function declare(list: Bindings): string {
  return list
    .map(
      ([name, access, type], k) =>
        `@group(0) @binding(${k}) var<${SPACE[access]}> ${name}: ${type};`,
    )
    .join('\n');
}

/**
 * A pipeline layout holding all of `list` in group 0, so every entry point of a module shares one
 * bind group whichever buffers it reads.
 */
export function layoutOf(
  device: GPUDevice,
  list: Bindings,
): {
  layout: GPUPipelineLayout;
  group(buffers: readonly GPUBuffer[]): GPUBindGroup;
} {
  const group = device.createBindGroupLayout({
    entries: list.map(([, access], binding) => ({
      binding,
      visibility: COMPUTE,
      buffer: { type: KIND[access] },
    })),
  });
  return {
    layout: device.createPipelineLayout({ bindGroupLayouts: [group] }),
    group(buffers) {
      if (buffers.length !== list.length)
        throw new Error(`blinken: ${buffers.length} buffers for ${list.length} bindings`);
      return device.createBindGroup({
        layout: group,
        entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
    },
  };
}
