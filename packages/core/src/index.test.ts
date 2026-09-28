import { describe, expect, it } from 'vitest';

describe('cta-core entry points', () => {
  it('loads the pure main barrel', async () => {
    await expect(import('./index.js')).resolves.toBeDefined();
  });

  it('exposes the Node adapters behind ./node', async () => {
    const node = await import('./node.js');
    expect(typeof node.readPackageVersion).toBe('function');
  });
});
