import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { MindmapData } from '../../../commons/model/MindmapData';

interface Props {
  data: MindmapData;
  unsavedNodeIds: string[];
  onSave: (nodeIds: string[]) => Promise<void>;
  onDismiss: () => void;
}

// eslint-disable-next-line import/prefer-default-export
export function SaveConceptsBar({
  data,
  unsavedNodeIds,
  onSave,
  onDismiss,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(unsavedNodeIds),
  );
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Array.from(selected));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        px: 2,
        py: 1,
        background: 'rgba(99,102,241,0.08)',
        borderBottom: '1px solid rgba(99,102,241,0.18)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <AutoAwesomeIcon fontSize="small" sx={{ color: '#6366f1' }} />
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {unsavedNodeIds.length} new concepts in this mindmap
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          disabled={saving || selected.size === 0}
        >
          {saving ? 'Saving…' : `Save ${selected.size} to study queue`}
        </Button>
        <Button size="small" onClick={() => setExpanded((x) => !x)}>
          {expanded ? 'Done' : 'Edit which'}
        </Button>
        <IconButton size="small" onClick={onDismiss}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      {expanded && (
        <Stack sx={{ mt: 1, maxHeight: 160, overflowY: 'auto' }}>
          {unsavedNodeIds.map((id) => {
            const node = data.nodes.find((n) => n.id === id);
            if (!node) return null;
            return (
              <Stack key={id} direction="row" alignItems="center" spacing={1}>
                <Checkbox
                  size="small"
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                />
                <Typography variant="body2">{node.data.text}</Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
