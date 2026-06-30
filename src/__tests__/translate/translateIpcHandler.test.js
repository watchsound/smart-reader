// Mock electron BEFORE requiring the handler module.
const _handlers = {};
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((name, fn) => {
      _handlers[name] = fn;
    }),
  },
}));

// Mock LearningPointService singleton.
const mockCreate = jest.fn(async (point /* , token */) => ({
  id: 'lp-mock',
  domainType: point.domainType,
  title: point.title,
  extras: point.extras,
}));

jest.mock('../../main/utils/LearningPointService', () => ({
  __esModule: true,
  default: { createLearningPoint: mockCreate },
  learningPointService: { createLearningPoint: mockCreate },
}));

const { registerTranslateHandlers } = require('../../main/ipc/translateHandlers');

beforeEach(() => {
  Object.keys(_handlers).forEach((k) => delete _handlers[k]);
  mockCreate.mockClear();
  registerTranslateHandlers({}, {});
});

describe('learning-point-create IPC handler', () => {
  test('handler is registered', () => {
    expect(_handlers['learning-point-create']).toBeDefined();
    expect(typeof _handlers['learning-point-create']).toBe('function');
  });

  test('routes payload to learningPointService.createLearningPoint', async () => {
    const payload = {
      domain: 'language',
      content: 'pattern: existential there-is',
      extras: {
        sourceLang: 'zh-Hans',
        targetLang: 'en-US',
        pattern: 'existential there-is for stative 有',
        bucket: 'tense',
        learnerAttempt: 'has',
        modelTarget: 'There are',
        reason: '...',
        hintsUsed: { svo: true },
      },
      featureSurface: 'translate-drill',
      token: 'tok-abc',
    };
    const result = await _handlers['learning-point-create'](null, payload);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [pointArg, tokenArg] = mockCreate.mock.calls[0];
    expect(tokenArg).toBe('tok-abc');
    expect(pointArg.domainType).toBe('language');
    expect(pointArg.front).toBe('pattern: existential there-is');
    // featureSurface stashed in extras for later mastery_event pickup
    expect(pointArg.extras.featureSurface).toBe('translate-drill');
    expect(pointArg.extras.bucket).toBe('tense');
    expect(result.id).toBe('lp-mock');
  });

  test('defaults domain to "language" and featureSurface to "translate-drill"', async () => {
    const result = await _handlers['learning-point-create'](null, {
      content: 'minimal',
      extras: {},
      token: 'tok-z',
    });
    const [pointArg] = mockCreate.mock.calls[0];
    expect(pointArg.domainType).toBe('language');
    expect(pointArg.extras.featureSurface).toBe('translate-drill');
    expect(result.id).toBe('lp-mock');
  });
});
