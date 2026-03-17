/**
 * SoundSettingsSection.js
 *
 * Settings section for configuring study session sound effects.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Switch,
  Slider,
  FormControlLabel,
  Grid,
  IconButton,
  Tooltip,
  Divider,
  Button,
  Chip,
  alpha,
} from '@mui/material';
import { styled } from '@mui/system';
import {
  VolumeUp as VolumeIcon,
  VolumeOff as MuteIcon,
  PlayArrow as PlayIcon,
  Delete as ClearIcon,
} from '@mui/icons-material';

import studyEnhancementApi, { SOUND_TYPES } from '../../api/studyEnhancementApi';

// Styled components
const SettingRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  '&:not(:last-child)': {
    borderBottom:
      theme.palette.mode === 'dark'
        ? '1px solid rgba(255,255,255,0.05)'
        : '1px solid rgba(0,0,0,0.05)',
  },
}));

const SettingLabel = styled(Box)({
  flex: 1,
});

const SettingLabelText = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  color: theme.palette.text.primary,
}));

const SettingLabelHint = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  marginTop: '2px',
}));

const SettingControl = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

const SOUND_INFO = {
  [SOUND_TYPES.FLIP]: {
    label: 'Card Flip',
    description: 'Sound when flipping flashcards',
  },
  [SOUND_TYPES.CORRECT]: {
    label: 'Correct Answer',
    description: 'Sound when you answer correctly (Good/Easy)',
  },
  [SOUND_TYPES.INCORRECT]: {
    label: 'Incorrect Answer',
    description: 'Sound when you answer incorrectly (Again/Hard)',
  },
  [SOUND_TYPES.STREAK]: {
    label: 'Streak Milestone',
    description: 'Sound when reaching streak milestones (5, 10, 25...)',
  },
  [SOUND_TYPES.COMPLETE]: {
    label: 'Session Complete',
    description: 'Sound when finishing a study session',
  },
  [SOUND_TYPES.LEVEL_UP]: {
    label: 'Level Up',
    description: 'Sound when a card is promoted to the next box',
  },
};

// Ensure config has proper boolean values (electron-store may return strings)
const normalizeConfig = (cfg) => {
  if (!cfg) return cfg;
  return {
    ...cfg,
    enabled: cfg.enabled === true || cfg.enabled === 'true',
    sounds: cfg.sounds
      ? Object.fromEntries(
          Object.entries(cfg.sounds).map(([key, val]) => [
            key,
            {
              ...val,
              enabled: val?.enabled === true || val?.enabled === 'true',
            },
          ]),
        )
      : cfg.sounds,
  };
};

export default function SoundSettingsSection() {
  const [config, setConfig] = useState(() => normalizeConfig(studyEnhancementApi.getSoundConfig()));
  const [cacheStats, setCacheStats] = useState(null);

  // Load cache stats
  useEffect(() => {
    const loadStats = async () => {
      const result = await studyEnhancementApi.getCacheStats();
      if (result.success) {
        setCacheStats(result.stats);
      }
    };
    loadStats();
  }, []);

  // Handle master toggle
  const handleMasterToggle = useCallback(() => {
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);
    studyEnhancementApi.setSoundConfig(newConfig);
  }, [config]);

  // Handle master volume
  const handleVolumeChange = useCallback((event, newValue) => {
    const newConfig = { ...config, volume: newValue };
    setConfig(newConfig);
    studyEnhancementApi.setSoundConfig(newConfig);
  }, [config]);

  // Handle individual sound toggle
  const handleSoundToggle = useCallback((soundType) => {
    const newConfig = {
      ...config,
      sounds: {
        ...config.sounds,
        [soundType]: {
          ...config.sounds[soundType],
          enabled: !config.sounds[soundType]?.enabled,
        },
      },
    };
    setConfig(newConfig);
    studyEnhancementApi.setSoundConfig(newConfig);
  }, [config]);

  // Handle individual sound volume
  const handleSoundVolume = useCallback((soundType, newValue) => {
    const newConfig = {
      ...config,
      sounds: {
        ...config.sounds,
        [soundType]: {
          ...config.sounds[soundType],
          volume: newValue,
        },
      },
    };
    setConfig(newConfig);
    studyEnhancementApi.setSoundConfig(newConfig);
  }, [config]);

  // Clear hint cache
  const handleClearHintCache = useCallback(async () => {
    const result = await studyEnhancementApi.clearHintCache();
    if (result.success) {
      const newStats = await studyEnhancementApi.getCacheStats();
      if (newStats.success) {
        setCacheStats(newStats.stats);
      }
    }
  }, []);

  // Clear pronunciation cache
  const handleClearPronunciationCache = useCallback(async () => {
    const result = await studyEnhancementApi.clearPronunciationCache();
    if (result.success) {
      const newStats = await studyEnhancementApi.getCacheStats();
      if (newStats.success) {
        setCacheStats(newStats.stats);
      }
    }
  }, []);

  // Format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box>
      {/* Master Controls */}
      <SettingRow>
        <SettingLabel>
          <SettingLabelText>Sound Effects</SettingLabelText>
          <SettingLabelHint>Enable or disable all sound effects</SettingLabelHint>
        </SettingLabel>
        <SettingControl>
          <Switch
            checked={config.enabled}
            onChange={handleMasterToggle}
            color="primary"
          />
        </SettingControl>
      </SettingRow>

      {config.enabled && (
        <>
          <SettingRow>
            <SettingLabel>
              <SettingLabelText>Master Volume</SettingLabelText>
              <SettingLabelHint>Overall volume for all sounds</SettingLabelHint>
            </SettingLabel>
            <SettingControl sx={{ width: 200 }}>
              <VolumeIcon fontSize="small" color="action" />
              <Slider
                value={config.volume}
                onChange={handleVolumeChange}
                min={0}
                max={1}
                step={0.1}
                size="small"
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
              />
            </SettingControl>
          </SettingRow>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
            Individual Sound Controls
          </Typography>

          {Object.entries(SOUND_INFO).map(([soundType, info]) => {
            const soundConfig = config.sounds?.[soundType] || { enabled: true, volume: 0.5 };
            return (
              <SettingRow key={soundType}>
                <SettingLabel>
                  <SettingLabelText>{info.label}</SettingLabelText>
                  <SettingLabelHint>{info.description}</SettingLabelHint>
                </SettingLabel>
                <SettingControl>
                  <Switch
                    checked={soundConfig.enabled !== false}
                    onChange={() => handleSoundToggle(soundType)}
                    size="small"
                  />
                  <Box sx={{ width: 100, mx: 1 }}>
                    <Slider
                      value={soundConfig.volume ?? 0.5}
                      onChange={(e, v) => handleSoundVolume(soundType, v)}
                      min={0}
                      max={1}
                      step={0.1}
                      size="small"
                      disabled={!soundConfig.enabled}
                    />
                  </Box>
                </SettingControl>
              </SettingRow>
            );
          })}
        </>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Cache Management */}
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        AI Cache Management
      </Typography>

      <SettingRow>
        <SettingLabel>
          <SettingLabelText>Hint Cache</SettingLabelText>
          <SettingLabelHint>
            AI-generated hints are cached to avoid repeated API calls
            {cacheStats?.byType?.hint && (
              <Chip
                label={`${cacheStats.byType.hint.count} items (${formatBytes(cacheStats.byType.hint.size)})`}
                size="small"
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </SettingLabelHint>
        </SettingLabel>
        <SettingControl>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<ClearIcon />}
            onClick={handleClearHintCache}
          >
            Clear
          </Button>
        </SettingControl>
      </SettingRow>

      <SettingRow>
        <SettingLabel>
          <SettingLabelText>Pronunciation Cache</SettingLabelText>
          <SettingLabelHint>
            Cached pronunciation data for text-to-speech
            {cacheStats?.byType?.pronunciation && (
              <Chip
                label={`${cacheStats.byType.pronunciation.count} items (${formatBytes(cacheStats.byType.pronunciation.size)})`}
                size="small"
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </SettingLabelHint>
        </SettingLabel>
        <SettingControl>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<ClearIcon />}
            onClick={handleClearPronunciationCache}
          >
            Clear
          </Button>
        </SettingControl>
      </SettingRow>

      {cacheStats && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.08),
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Total cached items: {cacheStats.totalEntries} ({formatBytes(cacheStats.totalSize)})
          </Typography>
        </Box>
      )}
    </Box>
  );
}
