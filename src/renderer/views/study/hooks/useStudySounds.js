/**
 * useStudySounds.js
 *
 * Custom hook for managing configurable sound effects in study sessions.
 * Supports system sounds, custom audio files, and TTS pronunciation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import studyEnhancementApi, { SOUND_TYPES } from '../../../api/studyEnhancementApi';

// Default sound URLs (can be overridden by user settings)
const DEFAULT_SOUNDS = {
  flip: null,        // No sound by default, or could be a whoosh
  correct: null,     // Positive ding
  incorrect: null,   // Soft buzz
  streak: null,      // Celebration sound
  complete: null,    // Success fanfare
  levelUp: null,     // Level up chime
};

/**
 * Create an audio context for playing sounds
 */
const createAudioContext = () => {
  if (typeof window !== 'undefined' && window.AudioContext) {
    return new window.AudioContext();
  }
  return null;
};

/**
 * Generate a simple tone using Web Audio API
 */
const playTone = (audioContext, frequency, duration, type = 'sine', volume = 0.3) => {
  if (!audioContext) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      oscillator.onended = resolve;
    } catch (err) {
      console.error('Error playing tone:', err);
      resolve();
    }
  });
};

/**
 * Play a sequence of tones (for melodies)
 */
const playMelody = async (audioContext, notes, volume = 0.3) => {
  if (!audioContext) return;

  for (const note of notes) {
    await playTone(audioContext, note.freq, note.duration, note.type || 'sine', volume);
    if (note.pause) {
      await new Promise(r => setTimeout(r, note.pause * 1000));
    }
  }
};

/**
 * Predefined sound patterns using Web Audio API
 */
const SOUND_PATTERNS = {
  flip: [
    { freq: 800, duration: 0.05, type: 'sine' },
  ],
  correct: [
    { freq: 523, duration: 0.1, type: 'sine' },  // C5
    { freq: 659, duration: 0.1, type: 'sine' },  // E5
    { freq: 784, duration: 0.15, type: 'sine' }, // G5
  ],
  incorrect: [
    { freq: 200, duration: 0.15, type: 'square' },
    { freq: 180, duration: 0.2, type: 'square' },
  ],
  streak: [
    { freq: 523, duration: 0.08 },
    { freq: 659, duration: 0.08 },
    { freq: 784, duration: 0.08 },
    { freq: 1047, duration: 0.2 },  // C6
  ],
  complete: [
    { freq: 523, duration: 0.1 },
    { freq: 659, duration: 0.1 },
    { freq: 784, duration: 0.1 },
    { freq: 1047, duration: 0.1 },
    { pause: 0.05 },
    { freq: 1047, duration: 0.3 },
  ],
  levelUp: [
    { freq: 392, duration: 0.1, type: 'triangle' },  // G4
    { freq: 523, duration: 0.1, type: 'triangle' },  // C5
    { freq: 659, duration: 0.15, type: 'triangle' }, // E5
    { freq: 784, duration: 0.25, type: 'triangle' }, // G5
  ],
};

/**
 * Hook for managing sound effects
 *
 * @param {Object} options - Hook options
 * @returns {Object} Sound management functions and state
 */
export default function useStudySounds(options = {}) {
  // Load config from storage
  const [config, setConfig] = useState(() => studyEnhancementApi.getSoundConfig());
  const [isInitialized, setIsInitialized] = useState(false);

  // Audio context ref
  const audioContextRef = useRef(null);

  // Audio elements cache
  const audioElementsRef = useRef({});

  // Speech synthesis ref
  const speechSynthRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    if (!isInitialized) {
      audioContextRef.current = createAudioContext();
      speechSynthRef.current = window.speechSynthesis || null;
      setIsInitialized(true);
    }

    return () => {
      // Cleanup
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isInitialized]);

  /**
   * Resume audio context (required after user interaction)
   */
  const resumeAudioContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  /**
   * Play a sound effect
   * @param {string} soundType - Type of sound from SOUND_TYPES
   * @param {Object} overrideOptions - Override options for this play
   */
  const playSound = useCallback(async (soundType, overrideOptions = {}) => {
    // Check if sounds are enabled
    if (!config.enabled) return;

    const soundConfig = config.sounds?.[soundType];
    if (!soundConfig?.enabled) return;

    // Calculate volume
    const volume = (config.volume || 0.5) * (soundConfig.volume || 0.5) * (overrideOptions.volume || 1);

    // Resume audio context if needed
    await resumeAudioContext();

    try {
      // Check for custom audio file
      if (soundConfig.file && soundConfig.file !== 'default') {
        // Try to play custom audio file
        if (!audioElementsRef.current[soundType]) {
          audioElementsRef.current[soundType] = new Audio(soundConfig.file);
        }
        const audio = audioElementsRef.current[soundType];
        audio.volume = volume;
        audio.currentTime = 0;
        await audio.play();
        return;
      }

      // Use Web Audio API for built-in sounds
      const pattern = SOUND_PATTERNS[soundType];
      if (pattern && audioContextRef.current) {
        await playMelody(audioContextRef.current, pattern, volume);
      }
    } catch (err) {
      console.error(`Error playing sound ${soundType}:`, err);
    }
  }, [config, resumeAudioContext]);

  /**
   * Play flip sound
   */
  const playFlip = useCallback(() => playSound(SOUND_TYPES.FLIP), [playSound]);

  /**
   * Play correct answer sound
   */
  const playCorrect = useCallback(() => playSound(SOUND_TYPES.CORRECT), [playSound]);

  /**
   * Play incorrect answer sound
   */
  const playIncorrect = useCallback(() => playSound(SOUND_TYPES.INCORRECT), [playSound]);

  /**
   * Play streak milestone sound
   * @param {number} streak - Current streak count
   */
  const playStreak = useCallback((streak) => {
    const milestones = config.streakMilestones || [5, 10, 25, 50, 100];
    if (milestones.includes(streak)) {
      playSound(SOUND_TYPES.STREAK);
    }
  }, [config.streakMilestones, playSound]);

  /**
   * Play session complete sound
   */
  const playComplete = useCallback(() => playSound(SOUND_TYPES.COMPLETE), [playSound]);

  /**
   * Play level up (box promotion) sound
   */
  const playLevelUp = useCallback(() => playSound(SOUND_TYPES.LEVEL_UP), [playSound]);

  /**
   * Speak text using TTS
   * @param {string} text - Text to speak
   * @param {Object} options - TTS options
   */
  const speak = useCallback(async (text, speechOptions = {}) => {
    if (!speechSynthRef.current) {
      console.warn('Speech synthesis not available');
      return;
    }

    // Cancel any ongoing speech
    speechSynthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechOptions.language || 'en-US';
    utterance.rate = speechOptions.rate || 1;
    utterance.pitch = speechOptions.pitch || 1;
    utterance.volume = (config.volume || 0.5) * (speechOptions.volume || 1);

    // Find voice if specified
    if (speechOptions.voice) {
      const voices = speechSynthRef.current.getVoices();
      const voice = voices.find(v =>
        v.name.toLowerCase().includes(speechOptions.voice.toLowerCase()) ||
        v.lang === speechOptions.voice
      );
      if (voice) utterance.voice = voice;
    }

    return new Promise((resolve, reject) => {
      utterance.onend = resolve;
      utterance.onerror = reject;
      speechSynthRef.current.speak(utterance);
    });
  }, [config.volume]);

  /**
   * Stop any ongoing speech
   */
  const stopSpeech = useCallback(() => {
    if (speechSynthRef.current) {
      speechSynthRef.current.cancel();
    }
  }, []);

  /**
   * Update sound configuration
   * @param {Object} newConfig - New configuration to merge
   */
  const updateConfig = useCallback((newConfig) => {
    const mergedConfig = {
      ...config,
      ...newConfig,
      sounds: {
        ...config.sounds,
        ...newConfig.sounds,
      },
    };

    setConfig(mergedConfig);
    studyEnhancementApi.setSoundConfig(mergedConfig);

    return mergedConfig;
  }, [config]);

  /**
   * Toggle all sounds on/off
   */
  const toggleSounds = useCallback(() => {
    updateConfig({ enabled: !config.enabled });
  }, [config.enabled, updateConfig]);

  /**
   * Toggle a specific sound
   * @param {string} soundType - Sound type to toggle
   */
  const toggleSound = useCallback((soundType) => {
    const currentEnabled = config.sounds?.[soundType]?.enabled ?? true;
    updateConfig({
      sounds: {
        [soundType]: { enabled: !currentEnabled },
      },
    });
  }, [config.sounds, updateConfig]);

  /**
   * Set master volume
   * @param {number} volume - Volume 0.0 to 1.0
   */
  const setVolume = useCallback((volume) => {
    updateConfig({ volume: Math.max(0, Math.min(1, volume)) });
  }, [updateConfig]);

  /**
   * Get available TTS voices
   */
  const getVoices = useCallback(() => {
    if (!speechSynthRef.current) return [];
    return speechSynthRef.current.getVoices();
  }, []);

  return {
    // Config
    config,
    isEnabled: config.enabled,

    // Sound playback
    playSound,
    playFlip,
    playCorrect,
    playIncorrect,
    playStreak,
    playComplete,
    playLevelUp,

    // TTS
    speak,
    stopSpeech,
    getVoices,

    // Configuration
    updateConfig,
    toggleSounds,
    toggleSound,
    setVolume,

    // Initialization
    isInitialized,
    resumeAudioContext,

    // Constants
    SOUND_TYPES,
  };
}
