/* eslint-disable prettier/prettier */
/**
 * SlashCommandMenu.js
 *
 * A dropdown menu that appears when user types "/" in the chat input.
 * Shows available commands including skills, with filtering as user types.
 *
 * Usage:
 * <SlashCommandMenu
 *   open={showMenu}
 *   anchorEl={inputRef.current}
 *   filter="sum"
 *   onSelect={(command) => handleCommand(command)}
 *   onClose={() => setShowMenu(false)}
 * />
 */

import React, { useMemo, useEffect, useRef } from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  Popper,
  Fade,
  ClickAwayListener,
  Divider,
} from '@mui/material';
import { styled, alpha, useTheme } from '@mui/material/styles';

// Icons for different command categories
import SummarizeIcon from '@mui/icons-material/Summarize';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import TranslateIcon from '@mui/icons-material/Translate';
import QuizIcon from '@mui/icons-material/Quiz';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SearchIcon from '@mui/icons-material/Search';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import SchoolIcon from '@mui/icons-material/School';
import StyleIcon from '@mui/icons-material/Style';
import HubIcon from '@mui/icons-material/Hub';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import PsychologyIcon from '@mui/icons-material/Psychology';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';

// Styled components
const MenuContainer = styled(Paper)(({ theme }) => ({
  maxHeight: 350,
  minWidth: 320,
  maxWidth: 400,
  overflow: 'auto',
  borderRadius: 12,
  boxShadow: theme.palette.mode === 'dark'
    ? '0 8px 32px rgba(0, 0, 0, 0.5)'
    : '0 8px 32px rgba(0, 0, 0, 0.15)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(theme.palette.text.primary, 0.15),
    borderRadius: 3,
  },
}));

const CommandItem = styled(ListItem)(({ theme, selected }) => ({
  padding: '8px 12px',
  cursor: 'pointer',
  borderRadius: 8,
  margin: '2px 6px',
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
  transition: 'background-color 0.15s ease',
}));

const CategoryHeader = styled(Box)(({ theme }) => ({
  padding: '8px 14px 4px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}));

const CategoryChip = styled(Chip)(({ chipcolor }) => ({
  height: 20,
  fontSize: '0.65rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  backgroundColor: alpha(chipcolor || theme.palette.primary.main, 0.12),
  color: chipcolor || theme.palette.primary.main,
  border: 'none',
}));

const CommandName = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '0.875rem',
  fontFamily: 'monospace',
  color: theme.palette.text.primary,
}));

const CommandDescription = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  lineHeight: 1.3,
  marginTop: 2,
}));

const ShortcutHint = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginLeft: 'auto',
  fontSize: '0.65rem',
  color: alpha(theme.palette.text.secondary, 0.7),
  '& kbd': {
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: alpha(theme.palette.divider, 0.5),
    fontFamily: 'monospace',
    fontSize: '0.65rem',
  },
}));

// Category colors
const CATEGORY_COLORS = {
  ai: '#6366f1',      // Indigo - AI skills
  data: '#10b981',    // Green - Data skills
  system: '#f59e0b',  // Amber - System commands
  util: '#8b5cf6',    // Purple - Utilities
  custom: '#ec4899',  // Pink - Custom/file-based skills
  general: '#6b7280', // Gray - General skills
};

// Icon mapping for skills
const SKILL_ICONS = {
  summarize: SummarizeIcon,
  grammar_check: SpellcheckIcon,
  translate: TranslateIcon,
  quiz_generate: QuizIcon,
  explain: LightbulbIcon,
  mindmap: AccountTreeIcon,
  search_notes: SearchIcon,
  create_note: NoteAddIcon,
  vocabulary: MenuBookIcon,
  analyze_structure: AnalyticsIcon,
  annotate: AutoFixHighIcon,
  text_simplify: AccessibilityNewIcon,
  smart_summary: AutoAwesomeIcon,
  extract_concepts: SchoolIcon,
  create_vocabulary: StyleIcon,
  query_graph: HubIcon,
  get_leitner_due: HistoryEduIcon,
  search_vocabulary: SearchIcon,
  create_quiz: QuizIcon,
  // File-based skills (from resources/skills)
  brainstorm: PsychologyIcon,
  study_guide: LibraryBooksIcon,
  flashcard_generate: ViewCarouselIcon,
};

// System commands (non-skill commands)
const SYSTEM_COMMANDS = [
  {
    name: 'clear',
    description: 'Clear chat history',
    category: 'system',
    icon: ClearIcon,
  },
  {
    name: 'new',
    description: 'Start a new chat',
    category: 'system',
    icon: RefreshIcon,
  },
  {
    name: 'help',
    description: 'Show available commands',
    category: 'system',
    icon: HelpOutlineIcon,
  },
  {
    name: 'settings',
    description: 'Open settings panel',
    category: 'system',
    icon: SettingsIcon,
  },
];

/**
 * SlashCommandMenu Component
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the menu is open
 * @param {HTMLElement} props.anchorEl - Element to anchor the menu to
 * @param {string} props.filter - Text to filter commands (after the "/")
 * @param {Function} props.onSelect - Callback when a command is selected
 * @param {Function} props.onClose - Callback to close the menu
 * @param {Array} props.skills - Available skills from skillApi
 * @param {number} props.selectedIndex - Currently selected item index (for keyboard nav)
 * @param {Function} props.onSelectedIndexChange - Callback when selected index changes
 */
function SlashCommandMenu({
  open,
  anchorEl,
  filter = '',
  onSelect,
  onClose,
  skills = [],
  selectedIndex = 0,
  // onSelectedIndexChange - reserved for future keyboard nav from parent
}) {
  const theme = useTheme();
  const listRef = useRef(null);

  // Build command list from skills + system commands
  const allCommands = useMemo(() => {
    const commands = [];

    // Add skill commands
    skills.forEach((skill) => {
      // For file-based skills, show them in a 'custom' category if their original category is general
      const isFileBased = skill.isFileBased || skill.source !== 'code';
      const effectiveCategory = isFileBased && skill.category === 'general'
        ? 'custom'
        : (skill.category || 'ai');

      commands.push({
        name: skill.name,
        description: skill.description,
        category: effectiveCategory,
        icon: SKILL_ICONS[skill.name] || AutoAwesomeIcon,
        isSkill: true,
        isFileBased,
        parameters: skill.parameters,
        requiredParams: skill.requiredParams,
        source: skill.source,
      });
    });

    // Add system commands
    SYSTEM_COMMANDS.forEach((cmd) => {
      commands.push({
        ...cmd,
        isSkill: false,
        isFileBased: false,
      });
    });

    return commands;
  }, [skills]);

  // Filter commands based on input
  const filteredCommands = useMemo(() => {
    if (!filter) return allCommands;

    const searchTerm = filter.toLowerCase();
    return allCommands.filter((cmd) =>
      cmd.name.toLowerCase().includes(searchTerm) ||
      cmd.description.toLowerCase().includes(searchTerm)
    );
  }, [allCommands, filter]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups = {};

    filteredCommands.forEach((cmd) => {
      const cat = cmd.category || 'other';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(cmd);
    });

    // Sort categories: ai first, then data, then custom, then system
    const order = ['ai', 'data', 'custom', 'general', 'system', 'util', 'other'];
    const sorted = {};
    order.forEach((cat) => {
      if (groups[cat]) {
        sorted[cat] = groups[cat];
      }
    });

    return sorted;
  }, [filteredCommands]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-command-index]');
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  // Handle click on command
  const handleSelect = (command) => {
    if (onSelect) {
      onSelect(command);
    }
  };

  // Get category display name
  const getCategoryName = (category) => {
    const names = {
      ai: 'AI Skills',
      data: 'Data & Search',
      system: 'System',
      util: 'Utilities',
      custom: 'Custom Skills',
      general: 'General',
      other: 'Other',
    };
    return names[category] || category;
  };

  // Flatten commands for keyboard navigation indexing
  const flatCommands = filteredCommands;

  if (!open || filteredCommands.length === 0) return null;

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="top-start"
      transition
      style={{ zIndex: 1400 }}
      modifiers={[
        {
          name: 'offset',
          options: {
            offset: [0, 8],
          },
        },
      ]}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={150}>
          <ClickAwayListener onClickAway={onClose}>
            <MenuContainer elevation={8}>
              {/* Header */}
              <Box
                sx={{
                  p: 1.5,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: theme.palette.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Commands
                </Typography>
                {filter && (
                  <Chip
                    size="small"
                    label={`/${filter}`}
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                    }}
                  />
                )}
                <ShortcutHint>
                  <kbd>↑↓</kbd> navigate <kbd>↵</kbd> select <kbd>esc</kbd> close
                </ShortcutHint>
              </Box>

              {/* Command list */}
              <List ref={listRef} dense sx={{ py: 0.5 }}>
                {Object.entries(groupedCommands).map(([category, commands], catIndex) => (
                  <React.Fragment key={category}>
                    {catIndex > 0 && (
                      <Divider sx={{ my: 0.5, mx: 2, opacity: 0.5 }} />
                    )}
                    <CategoryHeader>
                      <CategoryChip
                        label={getCategoryName(category)}
                        size="small"
                        chipcolor={CATEGORY_COLORS[category]}
                      />
                    </CategoryHeader>
                    {commands.map((cmd) => {
                      const globalIndex = flatCommands.findIndex(
                        (c) => c.name === cmd.name
                      );
                      const IconComponent = cmd.icon;

                      return (
                        <CommandItem
                          key={cmd.name}
                          selected={globalIndex === selectedIndex}
                          onClick={() => handleSelect(cmd)}
                          data-command-index={globalIndex}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 36,
                              color: CATEGORY_COLORS[cmd.category] || theme.palette.primary.main,
                            }}
                          >
                            <IconComponent fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <CommandName>/{cmd.name}</CommandName>
                            }
                            secondary={
                              <CommandDescription>
                                {cmd.description}
                              </CommandDescription>
                            }
                          />
                          {cmd.isFileBased && (
                            <Chip
                              size="small"
                              label="custom"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                bgcolor: alpha('#ec4899', 0.1),
                                color: '#ec4899',
                                mr: 0.5,
                              }}
                            />
                          )}
                          {cmd.isSkill && cmd.requiredParams?.length > 0 && (
                            <Chip
                              size="small"
                              label={`${cmd.requiredParams.length} param${cmd.requiredParams.length > 1 ? 's' : ''}`}
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                bgcolor: alpha(theme.palette.warning.main, 0.1),
                                color: theme.palette.warning.main,
                              }}
                            />
                          )}
                        </CommandItem>
                      );
                    })}
                  </React.Fragment>
                ))}
              </List>

              {/* Footer hint */}
              <Box
                sx={{
                  p: 1,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  bgcolor: alpha(theme.palette.background.default, 0.5),
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: alpha(theme.palette.text.secondary, 0.7),
                    fontSize: '0.65rem',
                  }}
                >
                  Type to filter commands. Skills with parameters will prompt for input.
                </Typography>
              </Box>
            </MenuContainer>
          </ClickAwayListener>
        </Fade>
      )}
    </Popper>
  );
}

export default SlashCommandMenu;
