// Mock window.electron.ipcRenderer BEFORE importing.
const invoke = jest.fn(async () => ({ id: 'lp-x' }));
global.window = global.window || {};
window.electron = { ipcRenderer: { invoke } };

// Mock customStorage to provide a session token.
jest.mock('../../renderer/store/customStorage', () => ({
  __esModule: true,
  default: { getSessionToken: () => 'tok-abc' },
}));

// eslint-disable-next-line global-require
const learningPointApi = require('../../renderer/api/learningPointApi').default;

describe('learningPointApi.create', () => {
  beforeEach(() => {
    invoke.mockClear();
  });

  test('routes to learning-point-create IPC with payload + session token', async () => {
    const result = await learningPointApi.create({
      domain: 'language',
      content: 'pattern: existential there-is',
      extras: { bucket: 'tense' },
      featureSurface: 'translate-drill',
    });
    expect(invoke).toHaveBeenCalledWith(
      'learning-point-create',
      expect.objectContaining({
        domain: 'language',
        content: 'pattern: existential there-is',
        extras: { bucket: 'tense' },
        featureSurface: 'translate-drill',
        token: 'tok-abc',
      }),
    );
    expect(result.id).toBe('lp-x');
  });
});
