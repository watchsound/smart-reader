/**
 * GoalStep.js
 *
 * Step 1: Define learning goal and domain
 * - Goal name/title input
 * - Domain type selection with visual cards
 * - Optional description
 */

import React, { useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Chip,
  InputAdornment,
  Fade,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Flag as GoalIcon,
  Translate as VocabularyIcon,
  Calculate as MathIcon,
  Language as LanguageIcon,
  Psychology as KnowledgeIcon,
  Build as SkillIcon,
  ArrowForward as NextIcon,
} from '@mui/icons-material';

import { DOMAIN_COLORS } from '../LearningPlanWizard';

// Styled components
const StepContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  minHeight: 400,
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const DomainCard = styled(Card, {
  shouldForwardProp: (prop) => !['domainColor', 'selected'].includes(prop),
})(({ theme, selected, domainColor }) => ({
  border: `2px solid ${selected ? domainColor : 'transparent'}`,
  background: selected
    ? alpha(domainColor, 0.08)
    : theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.02)'
      : 'rgba(0, 0, 0, 0.02)',
  transition: 'all 0.2s ease',
  height: '100%',
  '&:hover': {
    borderColor: alpha(domainColor, 0.5),
    background: alpha(domainColor, 0.05),
    transform: 'translateY(-2px)',
  },
}));

const DomainIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'domainColor',
})(({ theme, domainColor }) => ({
  width: 48,
  height: 48,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: alpha(domainColor, 0.15),
  color: domainColor,
  marginBottom: theme.spacing(1),
}));

const NavigationBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 'auto',
  paddingTop: theme.spacing(3),
}));

// Domain configuration
const DOMAINS = [
  {
    type: 'vocabulary',
    label: 'Vocabulary',
    description: 'Words, definitions, and language terms',
    icon: VocabularyIcon,
    examples: ['GRE words', 'Medical terms', 'Foreign language'],
  },
  {
    type: 'math',
    label: 'Math & Science',
    description: 'Formulas, theorems, and concepts',
    icon: MathIcon,
    examples: ['Calculus formulas', 'Physics laws', 'Chemistry equations'],
  },
  {
    type: 'language',
    label: 'Language Learning',
    description: 'Grammar, phrases, and expressions',
    icon: LanguageIcon,
    examples: ['Japanese grammar', 'Spanish phrases', 'Idioms'],
  },
  {
    type: 'knowledge',
    label: 'General Knowledge',
    description: 'Facts, dates, and information',
    icon: KnowledgeIcon,
    examples: ['History facts', 'Geography', 'Trivia'],
  },
  {
    type: 'skill',
    label: 'Skills & Procedures',
    description: 'Steps, techniques, and processes',
    icon: SkillIcon,
    examples: ['Coding patterns', 'Music theory', 'Recipes'],
  },
];

function GoalStep({ data, updateData, onNext, isValid }) {
  const handleGoalNameChange = useCallback(
    (e) => {
      updateData({ goalName: e.target.value });
    },
    [updateData]
  );

  const handleDomainSelect = useCallback(
    (domainType) => {
      updateData({ domainType });
    },
    [updateData]
  );

  const handleDescriptionChange = useCallback(
    (e) => {
      updateData({ description: e.target.value });
    },
    [updateData]
  );

  const goalName = data?.goalName || '';
  const domainType = data?.domainType || 'vocabulary';
  const description = data?.description || '';

  const selectedDomain = DOMAINS.find((d) => d.type === domainType);
  const domainColor = DOMAIN_COLORS[domainType]?.primary || '#666';

  return (
    <StepContainer>
      {/* Goal Name Input */}
      <Box>
        <SectionTitle variant="subtitle1">
          <GoalIcon fontSize="small" sx={{ color: domainColor }} />
          What do you want to learn?
        </SectionTitle>
        <TextField
          fullWidth
          placeholder="e.g., GRE Vocabulary, Japanese N2 Kanji, Calculus Formulas..."
          value={goalName}
          onChange={handleGoalNameChange}
          variant="outlined"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <GoalIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: domainColor,
                },
              },
            },
          }}
        />
      </Box>

      {/* Domain Selection */}
      <Box>
        <SectionTitle variant="subtitle1">Choose a domain</SectionTitle>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This helps optimize the learning algorithm for your content type.
        </Typography>

        <Grid container spacing={2}>
          {DOMAINS.map((domain) => {
            const Icon = domain.icon;
            const color = DOMAIN_COLORS[domain.type]?.primary || '#666';
            const isSelected = domainType === domain.type;

            return (
              <Grid item xs={12} sm={6} md={4} key={domain.type}>
                <DomainCard
                  selected={isSelected}
                  domainColor={color}
                  elevation={0}
                >
                  <CardActionArea
                    onClick={() => handleDomainSelect(domain.type)}
                    sx={{ height: '100%', p: 2 }}
                  >
                    <CardContent sx={{ p: 0 }}>
                      <DomainIcon domainColor={color}>
                        <Icon />
                      </DomainIcon>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {domain.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mb: 1 }}
                      >
                        {domain.description}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {domain.examples.map((example) => (
                          <Chip
                            key={example}
                            label={example}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              bgcolor: alpha(color, 0.1),
                              color: color,
                            }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </DomainCard>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Description (Optional) */}
      <Fade in={goalName.length > 0}>
        <Box>
          <SectionTitle variant="subtitle1">
            Add a description
            <Chip label="Optional" size="small" sx={{ ml: 1 }} />
          </SectionTitle>
          <TextField
            fullWidth
            multiline
            rows={2}
            placeholder="Describe your learning goal in more detail..."
            value={description}
            onChange={handleDescriptionChange}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Box>
      </Fade>

      {/* Navigation */}
      <NavigationBox>
        <Button
          variant="contained"
          endIcon={<NextIcon />}
          onClick={onNext}
          disabled={!isValid}
          sx={{
            px: 4,
            py: 1,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${domainColor}, ${alpha(domainColor, 0.8)})`,
            '&:hover': {
              background: `linear-gradient(135deg, ${domainColor}, ${domainColor})`,
            },
            '&.Mui-disabled': {
              background: 'rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          Continue
        </Button>
      </NavigationBox>
    </StepContainer>
  );
}

export default GoalStep;
