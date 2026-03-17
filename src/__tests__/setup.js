/**
 * Jest Setup File
 *
 * Global mocks and configurations for all tests.
 * This file runs before each test file (via setupFiles - no Jest globals available).
 */

// Mock OpenAI SDK globally to avoid "fetch is not defined" errors
// The OpenAI SDK requires a fetch polyfill in Node.js environment
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock response' } }],
        }),
      },
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }],
      }),
    },
  })),
}));

// Mock Anthropic SDK globally to avoid "fetch is not defined" errors
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock response' }],
      }),
    },
  })),
}));

// Create a shared mock for ipcRenderer that tests can access
// Tests that need custom mock behavior should modify window.ipcRenderer directly
const sharedIpcMock = {
  invoke: jest.fn().mockResolvedValue(null),
  send: jest.fn(),
  sendSync: jest.fn().mockReturnValue(null),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Make the mock available globally for tests to access
global.__ipcRendererMock = sharedIpcMock;

// Set up window.ipcRenderer using Object.defineProperty to make it overridable
if (typeof window !== 'undefined') {
  // Use a getter so tests can override by setting window.ipcRenderer directly
  Object.defineProperty(window, 'ipcRenderer', {
    get() {
      return global.__ipcRendererMock;
    },
    set(value) {
      global.__ipcRendererMock = value;
    },
    configurable: true,
  });
}
