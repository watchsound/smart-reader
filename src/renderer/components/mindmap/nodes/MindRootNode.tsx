import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Box, Typography } from '@mui/material';
import type { MindNodeType } from './MindNode';

function MindRootNodeImpl({ data }: NodeProps<MindNodeType>) {
  return (
    <Box
      sx={{
        minWidth: 160,
        maxWidth: 260,
        padding: '12px 18px',
        borderRadius: '14px',
        background:
          'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.18))',
        border: '2px solid rgba(99,102,241,0.55)',
        boxShadow: '0 2px 10px rgba(99,102,241,0.2)',
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 700, textAlign: 'center' }}
      >
        {data.text}
      </Typography>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
}

// eslint-disable-next-line import/prefer-default-export
export const MindRootNode = memo(MindRootNodeImpl);
