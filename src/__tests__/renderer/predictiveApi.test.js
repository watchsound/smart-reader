const api = require('../../renderer/api/predictiveApi');

describe('predictiveApi', () => {
  beforeEach(() => {
    if (typeof window === 'undefined') {
      global.window = {};
    }
    window.electron = { ipcRenderer: {
      invoke: jest.fn().mockResolvedValue({ ok: true }),
    } };
  });
  afterEach(() => { delete window.electron; });

  test('predict invokes predictive:predict', async () => {
    await api.predict({ featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary' });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      'predictive:predict',
      { featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary' },
    );
  });

  test('rank invokes predictive:rank', async () => {
    await api.rank([{ featureSurface: 'comprehension', currentBox: 2, domain: 'knowledge' }]);
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('predictive:rank', expect.any(Array));
  });

  test('refresh invokes predictive:refresh', async () => {
    await api.refresh({ force: true });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('predictive:refresh', { force: true });
  });

  test('report invokes predictive:report', async () => {
    await api.report({ windowDays: 30 });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('predictive:report', { windowDays: 30 });
  });
});
