/* eslint-disable prettier/prettier */
import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardHeader,
  Chip,
  IconButton,
  Skeleton,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import { buildImpressHTML } from './index';
import ImpressModal from './ImpressModal';

// Natural iframe dimensions before downscale.
const IFRAME_W = 960;
const IFRAME_H = 600;

// On-card preview dimensions — wider than before to fill message area better.
const PREVIEW_W = 520;
const PREVIEW_H = 325;

const SCALE = Math.min(PREVIEW_W / IFRAME_W, PREVIEW_H / IFRAME_H);

const PreviewBox = styled(Box)({
  position: 'relative',
  width: PREVIEW_W,
  height: PREVIEW_H,
  overflow: 'hidden',
  cursor: 'pointer',
  backgroundColor: '#0a0a0a',
  borderRadius: 8,
  '&:hover .play-overlay': {
    opacity: 1,
  },
  '&:hover .scaled-iframe': {
    filter: 'brightness(0.55)',
  },
});

const ScaledIframe = styled('iframe')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: IFRAME_W,
  height: IFRAME_H,
  border: 0,
  transform: `scale(${SCALE})`,
  transformOrigin: 'top left',
  pointerEvents: 'none',
  transition: 'filter 0.3s ease',
});

// Transparent click target sitting above the iframe
const ClickShield = styled(Box)({
  position: 'absolute',
  inset: 0,
  zIndex: 2,
});

// Cinema play overlay — fades in on hover
const PlayOverlay = styled(Box)({
  position: 'absolute',
  inset: 0,
  zIndex: 3,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 80%)',
  opacity: 0,
  transition: 'opacity 0.25s ease',
  borderRadius: 8,
  pointerEvents: 'none',
});

export default function EmbeddedPresentationCard({ slideData }) {
  const [htmlContent, setHtmlContent] = useState(null);
  const [buildFailed, setBuildFailed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!slideData?.data?.length) {
      setBuildFailed(true);
      return undefined;
    }
    (async () => {
      try {
        const html = await buildImpressHTML(slideData);
        if (cancelled) return;
        if (!html) setBuildFailed(true);
        else setHtmlContent(html);
      } catch (err) {
        console.error('[EmbeddedPresentationCard] buildImpressHTML failed:', err);
        if (!cancelled) setBuildFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slideData]);

  const slideCount = slideData?.data?.length ?? 0;
  const layoutTheme = slideData?.layout_theme;
  const globalMood = slideData?.global_mood;

  const header = (
    <CardHeader
      avatar={<SlideshowIcon sx={{ color: '#ffd700', fontSize: 20 }} />}
      title={
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>
          Presentation
        </Typography>
      }
      subheader={
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
          {slideCount} {slideCount === 1 ? 'slide' : 'slides'}
        </Typography>
      }
      action={
        !buildFailed && (
          <IconButton
            onClick={() => setModalOpen(true)}
            disabled={!htmlContent}
            sx={{
              color: 'rgba(255,255,255,0.5)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' },
            }}
            size="small"
            aria-label="Open presentation full-screen"
          >
            <OpenInFullIcon fontSize="small" />
          </IconButton>
        )
      }
      sx={{ pb: 0.5, pt: 1.5 }}
    />
  );

  if (buildFailed) {
    return (
      <Card sx={{
        bgcolor: '#111',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        {header}
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            Presentation unavailable.
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{
        background: 'linear-gradient(145deg, #111 0%, #141428 100%)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 6px 32px rgba(0,0,0,0.5)',
        display: 'inline-block',
      }}>
        {header}

        {/* Preview */}
        <Box sx={{ px: 2, pb: layoutTheme || globalMood ? 1 : 2 }}>
          <PreviewBox onClick={() => htmlContent && setModalOpen(true)}>
            {htmlContent ? (
              <>
                <ScaledIframe
                  className="scaled-iframe"
                  srcDoc={htmlContent}
                  title="Presentation preview"
                  sandbox="allow-scripts allow-same-origin"
                />
                <ClickShield />
                <PlayOverlay className="play-overlay">
                  <PlayCircleFilledIcon sx={{
                    fontSize: 60,
                    color: 'rgba(255,255,255,0.92)',
                    filter: 'drop-shadow(0 0 16px rgba(255,215,0,0.5))',
                  }} />
                  <Typography sx={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 11,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}>
                    Click to present
                  </Typography>
                </PlayOverlay>
              </>
            ) : (
              <Skeleton
                variant="rectangular"
                width={PREVIEW_W}
                height={PREVIEW_H}
                animation="wave"
                sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}
              />
            )}
          </PreviewBox>
        </Box>

        {/* Theme / mood chips */}
        {(layoutTheme || globalMood) && (
          <Box sx={{ px: 2, pb: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {layoutTheme && (
              <Chip
                label={layoutTheme}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,215,0,0.08)',
                  color: '#ffd700',
                  border: '1px solid rgba(255,215,0,0.2)',
                  fontSize: 10,
                  height: 20,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            )}
            {globalMood && (
              <Chip
                label={globalMood}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 10,
                  height: 20,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            )}
          </Box>
        )}
      </Card>

      <ImpressModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        htmlContent={htmlContent}
      />
    </>
  );
}
