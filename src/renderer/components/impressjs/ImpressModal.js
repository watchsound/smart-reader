/* eslint-disable prettier/prettier */
import { useEffect, useCallback, useState } from 'react';
import { styled } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const Overlay = styled('div')({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#000',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
});

// Top bar fades in when user mouses into the top 80px
const TopBar = styled('div')({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 72,
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
  zIndex: 10001,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '0 20px',
  opacity: 0,
  transition: 'opacity 0.25s ease',
  '&.visible': {
    opacity: 1,
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

// Keyboard hint — visible for a few seconds then fades
const KeyHint = styled(Typography)({
  position: 'absolute',
  bottom: 28,
  left: '50%',
  transform: 'translateX(-50%)',
  color: 'rgba(255,255,255,0.3)',
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  pointerEvents: 'none',
  transition: 'opacity 1s ease',
  whiteSpace: 'nowrap',
});

function ImpressModal({ open, onClose, htmlContent }) {
  const [topBarVisible, setTopBarVisible] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setHintVisible(true);
      const t = setTimeout(() => setHintVisible(false), 3500);
      return () => {
        clearTimeout(t);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open || !htmlContent) return null;

  return (
    <Overlay
      onMouseMove={(e) => setTopBarVisible(e.clientY < 80)}
      onMouseLeave={() => setTopBarVisible(false)}
    >
      {/* Gradient top bar with close button — appears on mouse approach */}
      <TopBar className={topBarVisible ? 'visible' : ''}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Esc to close
          </Typography>
          <IconButton
            onClick={onClose}
            size="medium"
            sx={{
              color: 'rgba(255,255,255,0.7)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
            }}
            aria-label="Close presentation"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </TopBar>

      <IframeContainer>
        <StyledIframe
          srcDoc={htmlContent}
          title="Impress.js Presentation"
          sandbox="allow-scripts allow-same-origin"
        />
      </IframeContainer>

      {/* Keyboard hint fades after 3.5s */}
      <KeyHint sx={{ opacity: hintVisible ? 1 : 0 }}>
        Space / Arrow keys to navigate
      </KeyHint>
    </Overlay>
  );
}

export default ImpressModal;
