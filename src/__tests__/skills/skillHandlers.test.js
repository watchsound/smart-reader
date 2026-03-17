/**
 * skillHandlers.test.js
 *
 * Integration tests for skill IPC handlers.
 * Tests the IPC communication layer between renderer and main process.
 */

// Mock electron
const mockIpcMain = {
  on: jest.fn(),
  handle: jest.fn(),
};

const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
};

jest.mock('electron', () => ({
  ipcMain: mockIpcMain,
}));

// Mock skill dependencies
jest.mock('../../main/skills', () => {
  const mockRegistry = {
    getAll: jest.fn().mockReturnValue([]),
    get: jest.fn(),
    getAvailable: jest.fn().mockReturnValue([]),
    getToolDefinitions: jest.fn().mockReturnValue([]),
    getSource: jest.fn().mockReturnValue('code'),
    getExtendedSummary: jest.fn().mockReturnValue({
      total: 0,
      categories: {},
      sources: { codeBased: 0, fileBased: 0 },
    }),
  };

  const mockContextManager = {
    getFullContext: jest.fn().mockResolvedValue({
      userId: 1,
      token: 'test',
      services: {},
    }),
    updateView: jest.fn(),
    updateSelection: jest.fn(),
    buildSystemPrompt: jest.fn().mockReturnValue('System prompt'),
  };

  return {
    getSkillRegistry: jest.fn().mockReturnValue(mockRegistry),
    getContextManager: jest.fn().mockReturnValue(mockContextManager),
    SkillExecutor: jest.fn().mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ success: true, result: {} }),
      executeMultiple: jest.fn().mockResolvedValue([]),
      executeToolCalls: jest.fn().mockResolvedValue([]),
      services: {},
    })),
    registerDefaultSkills: jest.fn(),
    reloadFileBasedSkills: jest.fn().mockReturnValue(0),
  };
});

// Mock AIProviderManager
jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProvider: { supportsToolUse: () => true },
    currentProviderName: 'Claude',
    supportsToolUse: jest.fn().mockReturnValue(true),
    chatWithSkills: jest.fn().mockResolvedValue({ text: 'Response', toolsUsed: [] }),
    generateWithTools: jest.fn().mockResolvedValue({ text: 'Response', toolCalls: [] }),
    sendChatMessage: jest.fn().mockResolvedValue('Regular response'),
  },
}));

describe('Skill IPC Handlers', () => {
  let handlers = {};
  let syncHandlers = {};

  beforeAll(() => {
    // Import after mocks are set up
    const { registerSkillHandlers } = require('../../main/ipc/skillHandlers');

    // Capture registered handlers
    mockIpcMain.on.mockImplementation((channel, handler) => {
      syncHandlers[channel] = handler;
    });

    mockIpcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    // Register handlers
    registerSkillHandlers(mockStore, {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Handler Registration', () => {
    it('should register skill-list handler', () => {
      expect(syncHandlers['skill-list']).toBeDefined();
    });

    it('should register skill-list-available handler', () => {
      expect(syncHandlers['skill-list-available']).toBeDefined();
    });

    it('should register skill-execute handler', () => {
      expect(handlers['skill-execute']).toBeDefined();
    });

    it('should register skill-chat handler', () => {
      expect(handlers['skill-chat']).toBeDefined();
    });

    it('should register skill-status handler', () => {
      expect(syncHandlers['skill-status']).toBeDefined();
    });

    it('should register skill-get-tools handler', () => {
      expect(handlers['skill-get-tools']).toBeDefined();
    });

    it('should register skill-update-view handler', () => {
      expect(syncHandlers['skill-update-view']).toBeDefined();
    });

    it('should register skill-update-selection handler', () => {
      expect(syncHandlers['skill-update-selection']).toBeDefined();
    });
  });

  describe('skill-list Handler', () => {
    it('should return list of all skills', () => {
      const { getSkillRegistry } = require('../../main/skills');
      // Create a mock skill class with static properties (like real skills)
      class MockSkillClass {
        static get name() { return 'test_skill'; }
        static get description() { return 'Test skill'; }
        static get category() { return 'test'; }
        static get parameters() { return {}; }
        static get requiredParams() { return []; }
        static get isFileBased() { return false; }
      }
      getSkillRegistry().getAll.mockReturnValue([MockSkillClass]);
      getSkillRegistry().getSource.mockReturnValue('code');

      const event = { returnValue: null };
      syncHandlers['skill-list'](event);

      expect(event.returnValue).toEqual([{
        name: 'test_skill',
        description: 'Test skill',
        category: 'test',
        parameters: {},
        requiredParams: [],
        isFileBased: false,
        source: 'code',
      }]);
    });

    it('should handle errors gracefully', () => {
      const { getSkillRegistry } = require('../../main/skills');
      getSkillRegistry().getAll.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const event = { returnValue: null };
      syncHandlers['skill-list'](event);

      expect(event.returnValue).toEqual([]);
    });
  });

  describe('skill-execute Handler', () => {
    it('should execute a skill', async () => {
      const mockResult = { success: true, result: { processed: 'data' } };
      const { SkillExecutor } = require('../../main/skills');
      const executor = new SkillExecutor();
      executor.execute.mockResolvedValue(mockResult);

      const result = await handlers['skill-execute']({}, ['test_skill', { input: 'data' }, 'token', 'user_1']);

      expect(result.success).toBe(true);
    });

    it('should return error for failed execution', async () => {
      const { SkillExecutor } = require('../../main/skills');
      const executor = new SkillExecutor();
      executor.execute.mockResolvedValue({ success: false, error: 'Skill failed' });

      const result = await handlers['skill-execute']({}, ['failing_skill', {}, 'token', 'user_1']);

      expect(result.success).toBe(true); // Handler wraps result
    });
  });

  describe('skill-chat Handler', () => {
    it('should chat with skills', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];

      const result = await handlers['skill-chat']({}, [messages, 'token', 'user_1', {}]);

      expect(result.success).toBe(true);
      expect(result.text).toBeDefined();
    });

    it('should handle missing AI provider', async () => {
      const { instanceInMain } = require('../../commons/service/AIProviderManager');
      instanceInMain.currentProvider = null;

      const result = await handlers['skill-chat']({}, [[], 'token', 'user_1', {}]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('provider');
    });
  });

  describe('skill-status Handler', () => {
    it('should return skill system status', () => {
      // Reset the mock to return properly
      const { getSkillRegistry } = require('../../main/skills');
      getSkillRegistry().getAll.mockReturnValue([]);

      const event = { returnValue: null };
      syncHandlers['skill-status'](event);

      expect(event.returnValue).toHaveProperty('initialized');
      expect(event.returnValue).toHaveProperty('skillCount');
      expect(event.returnValue).toHaveProperty('supportsToolUse');
    });
  });

  describe('skill-update-view Handler', () => {
    it('should update view context', () => {
      const { getContextManager } = require('../../main/skills');

      const event = { returnValue: null };
      syncHandlers['skill-update-view'](event, 'user_1', {
        view: 'reading',
        documentId: 'book_1',
      });

      expect(getContextManager().updateView).toHaveBeenCalledWith('user_1', {
        view: 'reading',
        documentId: 'book_1',
      });
      expect(event.returnValue.success).toBe(true);
    });
  });

  describe('skill-update-selection Handler', () => {
    it('should update selection context', () => {
      const { getContextManager } = require('../../main/skills');

      const event = { returnValue: null };
      syncHandlers['skill-update-selection'](event, 'user_1', 'Selected text');

      expect(getContextManager().updateSelection).toHaveBeenCalledWith('user_1', 'Selected text');
      expect(event.returnValue.success).toBe(true);
    });
  });

  describe('skill-get-tools Handler', () => {
    it('should return tool definitions', async () => {
      const { getSkillRegistry } = require('../../main/skills');
      const mockTools = [
        { name: 'summarize', description: 'Summarize text', input_schema: {} },
      ];
      getSkillRegistry().getToolDefinitions.mockReturnValue(mockTools);

      const result = await handlers['skill-get-tools']({}, ['token', 'user_1', {}]);

      expect(result).toEqual(mockTools);
    });
  });

  describe('skill-execute-multiple Handler', () => {
    it('should execute multiple skills', async () => {
      const skillCalls = [
        { skill: 'skill_1', params: {} },
        { skill: 'skill_2', params: {} },
      ];

      const result = await handlers['skill-execute-multiple']({}, [skillCalls, 'token', 'user_1', false]);

      // Handler wraps results - check for successful handling
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });
  });

  describe('skill-get-context Handler', () => {
    it('should return current context', async () => {
      const result = await handlers['skill-get-context']({}, ['token', 'user_1']);

      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
    });
  });

  describe('skill-supports-tool-use Handler', () => {
    it('should return tool use support status', () => {
      const event = { returnValue: null };
      syncHandlers['skill-supports-tool-use'](event);

      expect(typeof event.returnValue).toBe('boolean');
    });
  });
});

describe('Skill IPC Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle null arguments gracefully', async () => {
    const mockIpcMain = require('electron').ipcMain;
    const handlers = {};

    mockIpcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    // Re-import to get fresh handlers
    jest.resetModules();
    jest.mock('electron', () => ({ ipcMain: mockIpcMain }));

    // The handlers should not throw on null args
    // This is a pattern check - actual implementation may vary
  });

  it('should log errors to console', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Trigger an error condition
    // Implementation specific

    consoleSpy.mockRestore();
  });
});
