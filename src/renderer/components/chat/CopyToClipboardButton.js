import { Snackbar } from '@mui/material';
import { useState } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

function CopyToClipboardButton({ content }) {
  const [open, setOpen] = useState(false);
  const handleClick = () => {
    setOpen(true);
    navigator.clipboard.writeText(content);
  };

  return (
    <>
      <Tooltip title="Copy">
        <IconButton size="small" onClick={handleClick} aria-label="create">
          <ContentCopyIcon fontSize="small" />
        </IconButton>
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
