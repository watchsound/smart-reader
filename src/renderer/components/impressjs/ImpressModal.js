/* eslint-disable prettier/prettier */
import { useEffect, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

const Overlay = styled('div')({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.95)',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
});

const CloseButton = styled(IconButton)({
  position: 'absolute',
  top: 16,
  right: 16,
  color: '#fff',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  zIndex: 10000,
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

const IframeContainer = styled('div')({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const StyledIframe = styled('iframe')({
  width: '100%',
  height: '100%',
  border: 'none',
  backgroundColor: '#000',
});

function ImpressModal({ open, onClose, htmlContent }) {
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open || !htmlContent) return null;

  return (
    <Overlay>
      <CloseButton onClick={onClose} size="large">
        <CloseIcon fontSize="large" />
      </CloseButton>
      <IframeContainer>
        <StyledIframe
          srcDoc={htmlContent}
          title="Impress.js Presentation"
          sandbox="allow-scripts allow-same-origin"
        />
      </IframeContainer>
    </Overlay>
  );
}

export default ImpressModal;
