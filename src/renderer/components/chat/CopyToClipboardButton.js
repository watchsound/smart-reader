import { Snackbar } from '@mui/material';
import { useState } from 'react';
import { styled, alpha } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  width: 30,
  height: 30,
  borderRadius: 8,
  transition: 'all 0.15s ease-in-out',
  '& .MuiSvgIcon-root': {
    fontSize: 16,
  },
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.primary.main,
    transform: 'scale(1.08)',
  },
}));

function CopyToClipboardButton({ content }) {
  const [open, setOpen] = useState(false);
  const handleClick = () => {
    setOpen(true);
    navigator.clipboard.writeText(content);
  };

  return (
    <>
      <Tooltip title="Copy">
        <StyledIconButton size="small" onClick={handleClick} aria-label="copy">
          <ContentCopyIcon />
        </StyledIconButton>
      </Tooltip>
      <Snackbar
        open={open}
        onClose={() => setOpen(false)}
        autoHideDuration={2000}
        message="Copied to Clipboard"
      />
    </>
  );
}

export default CopyToClipboardButton;
