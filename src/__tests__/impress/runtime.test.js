const { getRuntimeBundleString } = require('../../renderer/components/impressjs/effects/runtime');

describe('effects/runtime', () => {
  test('returns a non-empty JS string', () => {
    const s = getRuntimeBundleString();
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(500);
  });

  test('bundle defines window.__impressEffects', () => {
    expect(getRuntimeBundleString()).toContain('window.__impressEffects');
  });

  test('bundle registers all 6 thin-slice descriptors', () => {
    const s = getRuntimeBundleString();
    expect(s).toContain("name: 'none', track: 'typography'");
    expect(s).toContain("name: 'blur_in', track: 'typography'");
    expect(s).toContain("name: 'none', track: 'background'");
    expect(s).toContain("name: 'gradient_flow', track: 'background'");
    expect(s).toContain("name: 'default', track: 'transition'");
    expect(s).toContain("name: 'depth_blur', track: 'transition'");
  });

  test('bundle executes cleanly in a sandboxed Function', () => {
    // Stub a fake window+document for the bundle to attach to
    const fakeWindow = {};
    const fakeDoc = {
      createElement: () => ({ id: '', textContent: '', remove: () => {} }),
      head: { appendChild: () => {} },
      body: { classList: { add: () => {}, remove: () => {} } },
      getElementById: () => null,
    };
    // Evaluate the bundle in a scope where `window` and `document` refer to our stubs
    const evalScope = new Function('window', 'document', getRuntimeBundleString());
    expect(() => evalScope(fakeWindow, fakeDoc)).not.toThrow();
    expect(fakeWindow.__impressEffects).toBeDefined();
    expect(typeof fakeWindow.__impressEffects.lookup).toBe('function');
    expect(fakeWindow.__impressEffects.lookup('typography', 'blur_in')).toBeTruthy();
    expect(fakeWindow.__impressEffects.lookup('background', 'gradient_flow')).toBeTruthy();
    expect(fakeWindow.__impressEffects.lookup('typography', '__nope__')).toBeNull();
  });
});
