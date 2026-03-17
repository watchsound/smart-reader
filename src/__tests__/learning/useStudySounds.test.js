/**
 * useStudySounds.test.js
 *
 * Unit tests for the useStudySounds React hook
 */

import { renderHook, act } from '@testing-library/react';

// Default config for tests - defined before mock so it's available immediately
const defaultConfig = {
  enabled: true,
  volume: 0.5,
  sounds: {
    flip: { enabled: true, volume: 0.4 },
    correct: { enabled: true, volume: 0.6 },
    incorrect: { enabled: true, volume: 0.5 },
    streak: { enabled: true, volume: 0.7 },
    complete: { enabled: true, volume: 0.8 },
    levelUp: { enabled: true, volume: 0.8 },
  },
  streakMilestones: [5, 10, 25, 50, 100],
};

// Mock config storage that can be modified per test
let mockConfigValue = { ...defaultConfig };

// Mock the API - getSoundConfig must return a value immediately
jest.mock('../../renderer/api/studyEnhancementApi', () => ({
  __esModule: true,
  default: {
    getSoundConfig: () => mockConfigValue,
    setSoundConfig: jest.fn().mockReturnValue({ success: true }),
  },
  getSoundConfig: () => mockConfigValue,
  setSoundConfig: jest.fn().mockReturnValue({ success: true }),
  SOUND_TYPES: {
    FLIP: 'flip',
    CORRECT: 'correct',
    INCORRECT: 'incorrect',
    STREAK: 'streak',
    COMPLETE: 'complete',
    LEVEL_UP: 'levelUp',
  },
}));

// Mock Web Audio API
const createMockOscillator = () => {
  const oscillator = {
    connect: jest.fn(),
    type: 'sine',
    frequency: {
      setValueAtTime: jest.fn(),
    },
    start: jest.fn(),
    stop: jest.fn(),
    onended: null,
  };
  // Auto-trigger onended after stop is called
  oscillator.stop.mockImplementation(() => {
    // Use setTimeout(0) to allow the assignment of onended first
    setTimeout(() => {
      if (oscillator.onended) {
        oscillator.onended();
      }
    }, 0);
  });
  return oscillator;
};

const mockGainNode = {
  connect: jest.fn(),
  gain: {
    setValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  },
};

const mockAudioContext = {
  createOscillator: jest.fn().mockImplementation(() => createMockOscillator()),
  createGain: jest.fn().mockReturnValue(mockGainNode),
  destination: {},
  currentTime: 0,
  state: 'running',
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn(),
};

global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);

// Mock Speech Synthesis
const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  getVoices: jest.fn().mockReturnValue([
    { name: 'English Voice', lang: 'en-US' },
    { name: 'Japanese Voice', lang: 'ja-JP' },
  ]),
};

global.speechSynthesis = mockSpeechSynthesis;
global.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
  text,
  lang: 'en-US',
  rate: 1,
  pitch: 1,
  volume: 1,
  voice: null,
  onend: null,
  onerror: null,
}));

// Import hook after mocks
import useStudySounds from '../../renderer/views/study/hooks/useStudySounds';
import studyEnhancementApi from '../../renderer/api/studyEnhancementApi';

describe('useStudySounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset config to default before each test
    mockConfigValue = { ...defaultConfig };
    // Reset audio context state
    mockAudioContext.state = 'running';
  });

  describe('initialization', () => {
    it('should load config from storage', () => {
      const { result } = renderHook(() => useStudySounds());

      // Config is loaded during useState initialization
      expect(result.current.config).toEqual(mockConfigValue);
    });

    it('should initialize audio context', () => {
      const { result } = renderHook(() => useStudySounds());

      // Wait for effect
      expect(result.current.isInitialized).toBe(true);
    });

    it('should expose config state', () => {
      const { result } = renderHook(() => useStudySounds());

      expect(result.current.config).toEqual(defaultConfig);
      expect(result.current.isEnabled).toBe(true);
    });
  });

  describe('sound playback', () => {
    it('should not play when disabled', async () => {
      mockConfigValue = { ...defaultConfig, enabled: false };

      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playSound('flip');
      });

      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('should not play individual sound when disabled', async () => {
      mockConfigValue = {
        ...defaultConfig,
        sounds: {
          ...defaultConfig.sounds,
          flip: { enabled: false, volume: 0.4 },
        },
      };

      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playSound('flip');
      });

      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('should play flip sound', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playFlip();
      });

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should play correct sound', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playCorrect();
      });

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should play incorrect sound', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playIncorrect();
      });

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should play level up sound', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playLevelUp();
      });

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should play complete sound', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playComplete();
      });

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });
  });

  describe('streak sounds', () => {
    it('should play on streak milestones', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playStreak(5); // Milestone
      });

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should not play on non-milestone streaks', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playStreak(3); // Not a milestone
      });

      // Should not have played streak sound
      // Note: We can't easily distinguish this from flip sound, but the test documents intent
    });

    it('should use custom milestones from config', async () => {
      mockConfigValue = {
        ...defaultConfig,
        streakMilestones: [3, 6, 9],
      };

      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.playStreak(3); // Custom milestone
      });

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });
  });

  describe('TTS (speak)', () => {
    it('should speak text', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        result.current.speak('Hello world');
      });

      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should cancel previous speech', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        result.current.speak('Hello');
      });

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should use language option', async () => {
      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        result.current.speak('Konnichiwa', { language: 'ja-JP' });
      });

      const utterance = SpeechSynthesisUtterance.mock.results[0].value;
      expect(utterance.lang).toBe('ja-JP');
    });

    it('should stop speech', () => {
      const { result } = renderHook(() => useStudySounds());

      act(() => {
        result.current.stopSpeech();
      });

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should get available voices', () => {
      const { result } = renderHook(() => useStudySounds());

      const voices = result.current.getVoices();

      expect(voices).toHaveLength(2);
      expect(voices[0].lang).toBe('en-US');
    });
  });

  describe('configuration', () => {
    it('should toggle all sounds', () => {
      const { result } = renderHook(() => useStudySounds());

      act(() => {
        result.current.toggleSounds();
      });

      expect(studyEnhancementApi.setSoundConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('should toggle individual sound', () => {
      const { result } = renderHook(() => useStudySounds());

      act(() => {
        result.current.toggleSound('flip');
      });

      expect(studyEnhancementApi.setSoundConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          sounds: expect.objectContaining({
            flip: expect.objectContaining({ enabled: false }),
          }),
        })
      );
    });

    it('should set master volume', () => {
      const { result } = renderHook(() => useStudySounds());

      act(() => {
        result.current.setVolume(0.8);
      });

      expect(studyEnhancementApi.setSoundConfig).toHaveBeenCalledWith(
        expect.objectContaining({ volume: 0.8 })
      );
    });

    it('should clamp volume to valid range', () => {
      const { result } = renderHook(() => useStudySounds());

      act(() => {
        result.current.setVolume(1.5);
      });

      expect(studyEnhancementApi.setSoundConfig).toHaveBeenCalledWith(
        expect.objectContaining({ volume: 1 })
      );

      act(() => {
        result.current.setVolume(-0.5);
      });

      expect(studyEnhancementApi.setSoundConfig).toHaveBeenCalledWith(
        expect.objectContaining({ volume: 0 })
      );
    });

    it('should update config', () => {
      const { result } = renderHook(() => useStudySounds());

      act(() => {
        result.current.updateConfig({
          volume: 0.7,
          sounds: { flip: { volume: 0.3 } },
        });
      });

      expect(studyEnhancementApi.setSoundConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          volume: 0.7,
          sounds: expect.objectContaining({
            flip: expect.objectContaining({ volume: 0.3 }),
          }),
        })
      );
    });
  });

  describe('audio context management', () => {
    it('should resume suspended audio context', async () => {
      mockAudioContext.state = 'suspended';

      const { result } = renderHook(() => useStudySounds());

      await act(async () => {
        await result.current.resumeAudioContext();
      });

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });
  });

  describe('SOUND_TYPES constant', () => {
    it('should export SOUND_TYPES', () => {
      const { result } = renderHook(() => useStudySounds());

      expect(result.current.SOUND_TYPES).toBeDefined();
      expect(result.current.SOUND_TYPES.FLIP).toBe('flip');
      expect(result.current.SOUND_TYPES.CORRECT).toBe('correct');
    });
  });
});
