/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { Box, TextField, Button, Avatar, Tooltip, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PERSONAS, PERSONA_ORDER } from '../../../commons/model/forumPersonas';

const PERSONA_COLORS = {
  moderator: '#7E57C2',
  skeptic: '#EF5350',
  synthesizer: '#26A69A',
  novice: '#FFA726',
};

export default function ForumReplyInput({ onSubmit, disabled }) {
  const [text, setText] = useState('');
  const [addressedTo, setAddressedTo] = useState(null);

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSubmit({ userContent: text.trim(), addressedTo });
    setText('');
    setAddressedTo(null);
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {PERSONA_ORDER.map((id) => {
          const p = PERSONAS[id];
          const active = addressedTo === id;
          return (
            <Tooltip key={id} title={`Address ${p.name} (${p.role})`}>
              <Avatar
                onClick={() => setAddressedTo(active ? null : id)}
                sx={{
                  width: 28,
                  height: 28,
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  bgcolor: active
                    ? PERSONA_COLORS[id]
                    : alpha(PERSONA_COLORS[id], 0.3),
                  border: active ? `2px solid ${PERSONA_COLORS[id]}` : 'none',
                }}
              >
                {p.name[0]}
              </Avatar>
            </Tooltip>
          );
        })}
        {addressedTo && (
          <Chip
            size="small"
            label={`→ ${PERSONAS[addressedTo].name}`}
            onDelete={() => setAddressedTo(null)}
            sx={{ ml: 1, height: 22 }}
          />
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Join the discussion…"
          multiline
          minRows={1}
          maxRows={4}
          size="small"
          fullWidth
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
          }}
        />
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
        >
          Post
        </Button>
      </Box>
    </Box>
  );
}
