/* eslint-disable react/prop-types */
import React from 'react';
import { Box, Avatar, Typography, Tooltip, Chip } from '@mui/material';
import { alpha, styled, useTheme } from '@mui/material/styles';
import { PERSONAS } from '../../../commons/model/forumPersonas';

const PERSONA_COLORS = {
  moderator: '#7E57C2',
  skeptic: '#EF5350',
  synthesizer: '#26A69A',
  novice: '#FFA726',
  user: '#42A5F5',
};

const TurnRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isUser',
})(({ isUser }) => ({
  display: 'flex',
  flexDirection: isUser ? 'row-reverse' : 'row',
  gap: 10,
  marginBottom: 12,
  alignItems: 'flex-start',
}));

const Bubble = styled(Box, {
  shouldForwardProp: (p) => p !== 'isUser' && p !== 'personaColor',
})(({ theme, isUser, personaColor }) => ({
  maxWidth: '78%',
  padding: '10px 12px',
  borderRadius: 12,
  border: `1px solid ${alpha(personaColor, 0.3)}`,
  background: isUser
    ? alpha(personaColor, 0.08)
    : theme.palette.background.paper,
}));

export default function ForumTurnCard({ turn }) {
  const theme = useTheme();
  const isUser = turn.persona === 'user';
  const persona = isUser ? null : PERSONAS[turn.persona];
  const color = PERSONA_COLORS[turn.persona] || '#999';
  const label = isUser ? 'You' : (persona && persona.name) || turn.persona;
  const role = isUser ? '' : (persona && persona.role) || '';
  // Persona avatar shows the cartoon emoji; user avatar falls back to initial.
  const avatarContent = isUser ? label[0] : persona?.emoji || label[0];

  return (
    <TurnRow isUser={isUser}>
      <Avatar
        sx={{
          width: 36,
          height: 36,
          bgcolor: color,
          fontSize: isUser ? '0.85rem' : '1.1rem',
        }}
      >
        {avatarContent}
      </Avatar>
      <Box sx={{ flex: '0 1 auto' }}>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            mb: 0.5,
            flexDirection: isUser ? 'row-reverse' : 'row',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          {role && (
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              · {role}
            </Typography>
          )}
          {turn.addressedTo && isUser && (
            <Chip
              size="small"
              label={`→ ${PERSONAS[turn.addressedTo]?.name || turn.addressedTo}`}
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          )}
        </Box>
        <Bubble isUser={isUser} personaColor={color}>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            {turn.content}
          </Typography>
        </Bubble>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mt: 0.5,
            justifyContent: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontSize: '0.65rem',
            }}
          >
            {turn.ts
              ? new Date(turn.ts).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </Typography>
          {isUser && typeof turn.cost_usd === 'number' && turn.cost_usd > 0 && (
            <Tooltip title="Generation cost for this reply">
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  color: theme.palette.text.secondary,
                  fontSize: '0.65rem',
                }}
              >
                ${turn.cost_usd.toFixed(4)}
              </Typography>
            </Tooltip>
          )}
        </Box>
      </Box>
    </TurnRow>
  );
}
