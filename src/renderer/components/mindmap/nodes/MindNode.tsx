import React, { memo, useCallback } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getMasteryBand } from '../../../../commons/utils/masteryRamp';
import type { MindmapNodeData } from '../../../../commons/model/MindmapData';

export interface MindNodeRuntimeData extends MindmapNodeData {
  onActivate: (nodeId: string, lpId?: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  childCount: number;
  isCollapsed: boolean;
  [key: string]: unknown;
}

export type MindNodeType = Node<MindNodeRuntimeData, 'mind'>;

function MindNodeImpl({ id, data, selected }: NodeProps<MindNodeType>) {
  const band = getMasteryBand(data.domain, data.masteryLevel);
  const handleClick = useCallback(() => {
    data.onActivate(id, data.learningPointId);
  }, [id, data]);
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onToggleCollapse(id);
    },
    [id, data],
  );

  return (
    <Box
      onClick={handleClick}
      sx={{
        position: 'relative',
        minWidth: 120,
        maxWidth: 220,
        padding: '8px 12px 8px 16px',
        borderRadius: '10px',
        background: band.tint,
        border: selected
          ? `2px solid ${band.accent}`
          : `1px solid rgba(0,0,0,0.08)`,
        boxShadow: band.glow
          ? `0 0 0 2px ${band.accent}33`
          : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        '&:hover': { boxShadow: `0 2px 8px ${band.accent}22` },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          borderRadius: '10px 0 0 10px',
          backgroundColor: band.accent,
        }}
      />
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          lineHeight: 1.25,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {data.text}
      </Typography>
      {data.childCount > 0 && (
        <Tooltip
          title={data.isCollapsed ? 'Expand subtree' : 'Collapse subtree'}
        >
          <IconButton
            size="small"
            onClick={handleToggle}
            sx={{ position: 'absolute', right: 2, bottom: 2, padding: '2px' }}
          >
            {data.isCollapsed ? (
              <ChevronRightIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
}

export const MindNode = memo(MindNodeImpl);
