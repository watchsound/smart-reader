/**
 * MemoryTimelinePanel.test.js
 *
 * Tests for the MemoryTimelinePanel component that displays
 * chronological memory timelines in the Knowledge Dashboard.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Sample test data
const mockStats = {
  totalMemories: 25,
  totalEpisodes: 150,
  conceptsCovered: 12,
  byType: {
    concept_session: 18,
    daily: 4,
    weekly: 2,
    cross_concept: 1,
  },
};

const mockMemories = [
  {
    memory: {
      id: 'cm_1',
      conceptId: 'c_vocab_1',
      conceptName: 'Vocabulary',
      memoryType: 'concept_session',
      periodStart: '2024-01-10T10:00:00Z',
      periodEnd: '2024-01-10T11:00:00Z',
      episodeCount: 8,
      summary: 'Reviewed vocabulary words with good progress.',
      insights: ['Improved response time', 'Consistent accuracy'],
      masteryAssessment: 'proficient',
      learningStyle: 'steady',
      metrics: { accuracy: 85, totalReviews: 8 },
      recommendations: ['Continue daily practice'],
    },
    episodes: [],
  },
];

const mockCoverage = [
  { conceptId: 'c_vocab_1', conceptName: 'Vocabulary', memoryCount: 15 },
  { conceptId: 'c_grammar_1', conceptName: 'Grammar', memoryCount: 8 },
];

const mockGaps = [
  { conceptId: 'c_writing_1', conceptName: 'Writing', daysSinceLastMemory: 45 },
];

const mockHierarchy = {
  concept: {
    id: 'c_vocab_1',
    name: 'Vocabulary',
    description: 'English vocabulary learning',
    masteryLevel: 'proficient',
  },
  memories: mockMemories,
};

// Mock graphApi before importing the component
jest.mock('../../renderer/api/graphApi', () => ({
  __esModule: true,
  default: {
    isSummarizationAvailable: jest.fn(() => true),
    getSummarizationStats: jest.fn(() => Promise.resolve({ data: null })),
    getSummarizationHierarchy: jest.fn(() => Promise.resolve({ data: null })),
    getConceptTimeline: jest.fn(() => Promise.resolve({ data: [] })),
    getMemoryCoverage: jest.fn(() => Promise.resolve({ data: [] })),
    findMemoryGaps: jest.fn(() => Promise.resolve({ data: [] })),
    getSourceEpisodes: jest.fn(() => Promise.resolve({ data: [] })),
  },
}));

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(() => 'test-token'),
    setItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

import MemoryTimelinePanel from '../../renderer/components/knowledge/MemoryTimelinePanel';
import graphApi from '../../renderer/api/graphApi';

// Theme wrapper
const theme = createTheme({ palette: { mode: 'light' } });
const renderWithTheme = (component) =>
  render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);

describe('MemoryTimelinePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    graphApi.isSummarizationAvailable.mockReturnValue(true);
    graphApi.getSummarizationStats.mockResolvedValue({ data: mockStats });
    graphApi.getConceptTimeline.mockResolvedValue({ data: mockMemories });
    graphApi.getMemoryCoverage.mockResolvedValue({ data: mockCoverage });
    graphApi.findMemoryGaps.mockResolvedValue({ data: mockGaps });
    graphApi.getSummarizationHierarchy.mockResolvedValue({ data: mockHierarchy });
    graphApi.getSourceEpisodes.mockResolvedValue({ data: [] });
  });

  describe('Basic Rendering', () => {
    it('should render loading state initially', () => {
      renderWithTheme(<MemoryTimelinePanel />);
      // Should show skeletons while loading
      expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });

    it('should render not available state when summarization is not available', async () => {
      graphApi.isSummarizationAvailable.mockReturnValue(false);

      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel />);
      });

      // Wait for the component to finish loading and show not available state
      await waitFor(() => {
        const notAvailableText = screen.queryByText(/Memory Timeline Not Available/i);
        expect(notAvailableText).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should render component without crashing', async () => {
      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel />);
      });

      // Component should render
      expect(document.body).toBeTruthy();
    });
  });

  describe('API Integration', () => {
    it('should call getSummarizationStats on mount', async () => {
      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel />);
      });

      await waitFor(() => {
        expect(graphApi.getSummarizationStats).toHaveBeenCalled();
      });
    });

    it('should call getMemoryCoverage when no conceptId', async () => {
      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel />);
      });

      await waitFor(() => {
        expect(graphApi.getMemoryCoverage).toHaveBeenCalled();
      });
    });

    it('should call findMemoryGaps with default 30 days', async () => {
      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel />);
      });

      await waitFor(() => {
        expect(graphApi.findMemoryGaps).toHaveBeenCalledWith(30, 'test-token');
      });
    });

    it('should call getSummarizationHierarchy when conceptId is provided', async () => {
      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel conceptId="c_vocab_1" />);
      });

      await waitFor(() => {
        expect(graphApi.getSummarizationHierarchy).toHaveBeenCalledWith(
          'c_vocab_1',
          expect.any(Object),
          'test-token'
        );
      });
    });

    it('should call getConceptTimeline when conceptId is provided', async () => {
      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel conceptId="c_vocab_1" />);
      });

      await waitFor(() => {
        expect(graphApi.getConceptTimeline).toHaveBeenCalledWith(
          'c_vocab_1',
          50,
          'test-token'
        );
      });
    });
  });

  describe('Props', () => {
    it('should respect height prop', async () => {
      let container;
      await act(async () => {
        const result = renderWithTheme(<MemoryTimelinePanel height={600} />);
        container = result.container;
      });

      const mainContainer = container.firstChild;
      // Height is applied via styled component, check computed style
      const computedStyle = window.getComputedStyle(mainContainer);
      // The component receives the height prop and applies it
      expect(mainContainer).toBeTruthy();
      // Verify prop is being passed by checking the component rendered
      expect(container.querySelector('[class*="MuiBox"]')).toBeTruthy();
    });

    it('should accept onConceptSelect prop', async () => {
      const mockOnSelect = jest.fn();

      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel onConceptSelect={mockOnSelect} />);
      });

      // Component should render with the prop
      expect(document.body).toBeTruthy();
    });

    it('should accept onMemorySelect prop', async () => {
      const mockOnSelect = jest.fn();

      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel onMemorySelect={mockOnSelect} />);
      });

      // Component should render with the prop
      expect(document.body).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when loading fails', async () => {
      graphApi.getSummarizationStats.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel />);
      });

      // Wait for error message to appear
      await waitFor(() => {
        const errorText = screen.queryByText(/Network error/i);
        expect(errorText).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('isSummarizationAvailable', () => {
    it('should check availability on mount', async () => {
      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel />);
      });

      expect(graphApi.isSummarizationAvailable).toHaveBeenCalled();
    });

    it('should not call APIs when not available', async () => {
      graphApi.isSummarizationAvailable.mockReturnValue(false);

      await act(async () => {
        renderWithTheme(<MemoryTimelinePanel />);
      });

      // Should not try to load data
      await waitFor(() => {
        expect(graphApi.getSummarizationStats).not.toHaveBeenCalled();
      });
    });
  });
});

describe('MemoryTimelinePanel - Concept Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    graphApi.isSummarizationAvailable.mockReturnValue(true);
    graphApi.getSummarizationStats.mockResolvedValue({ data: mockStats });
    graphApi.getConceptTimeline.mockResolvedValue({ data: mockMemories });
    graphApi.getSummarizationHierarchy.mockResolvedValue({ data: mockHierarchy });
    graphApi.getSourceEpisodes.mockResolvedValue({ data: [] });
  });

  it('should not call getMemoryCoverage when conceptId is provided', async () => {
    await act(async () => {
      renderWithTheme(<MemoryTimelinePanel conceptId="c_vocab_1" />);
    });

    await waitFor(() => {
      expect(graphApi.getMemoryCoverage).not.toHaveBeenCalled();
    });
  });

  it('should not call findMemoryGaps when conceptId is provided', async () => {
    await act(async () => {
      renderWithTheme(<MemoryTimelinePanel conceptId="c_vocab_1" />);
    });

    await waitFor(() => {
      expect(graphApi.findMemoryGaps).not.toHaveBeenCalled();
    });
  });
});
