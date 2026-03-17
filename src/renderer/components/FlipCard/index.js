import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, CardContent, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/system';
import html2canvas from 'html2canvas';

/**
 *
 * 1. Show the initial images (images.left1 and images.right1).
   2. Rotate images.right1 by 90 degrees to reveal images.right2.
   3.  Remove images.right1 and fully reveal images.right2.
   4.  Rotate images.left2 to cover images.left1.
 */

const FlipCardContainer = styled(Box)(({ width, height }) => ({
  perspective: '2000px',
  width: `${width}px`,
  height: `${height}px`,
  position: 'relative',
  overflow: 'hidden',
}));

const ImageContainer = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
});

const flipForwardRight = keyframes`
  0% { transform: rotateY(0); }
  100% { transform: rotateY(-90deg); }
`;

const flipForwardLeft = keyframes`
  0% { transform: rotateY(90deg); }
  100% { transform: rotateY(0); }
`;

const flipBackwardLeft = keyframes`
  0% { transform: rotateY(0); }
  100% { transform: rotateY(90deg); }
`;

const flipBackwardRight = keyframes`
  0% { transform: rotateY(-90deg); }
  100% { transform: rotateY(0); }
`;

const getZIndex = (side, phase, forward) => {
  if (phase === 3) {
    if (side === 'left2' || side === 'right2') return 2;
    return 1;
  }
  if (side === 'left2' || side === 'right2') return 1;
  return 2;
};

const getAnimation = (side, phase, forward) => {
  if (forward) {
    if (side === 'right1' && phase === 2) return `${flipForwardRight} 1s forwards`;
    if (side === 'left2' && phase === 3) return `${flipForwardLeft} 1s forwards`;
    return 'none';
  }
  if (side === 'left1' && phase === 2) return `${flipBackwardLeft} 1s forwards`;
  if (side === 'right2' && phase === 3) return `${flipBackwardRight} 1s forwards`;
  return 'none';
};


const ImageHalf = styled(Box)(({ side, image, phase, forward }) => ({
  position: 'absolute',
  top: 0,
  left: side === 'left1' || side === 'left2' ? 0 : '50%',
  width: '50%',
  height: '100%',
  backgroundImage: `url(${image})`,
  backgroundPosition: side === 'left1' || side === 'left2' ? 'left' : 'right',
  backgroundSize: 'cover',
  transformOrigin: side === 'left1' || side === 'left2' ? 'right' : 'left',
  backfaceVisibility: 'hidden',
  zIndex: getZIndex(side, phase, forward),
  animation: getAnimation(side, phase, forward),
}));

const HiddenContent = styled(Box)(({ width, height }) => ({
  position: 'absolute',
  top: '-10000px',
  left: '-10000px',
  width: `${width}px`,
  height: `${height}px`,
}));


function FlipCard({ cards, width, height, curCardIndex }) {
  const [flipping, setFlipping] = useState(false);
  const [forward, setForward] = useState(1);
  const [phase, setPhase] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState({
    left1: '',
    right1: '',
    left2: '',
    right2: '',
  });
  const contentRef = useRef();
  const hiddenContentRef = useRef();

  const handleFlip = async (forward) => {
    if (
      (forward && currentIndex < cards.length - 1) ||
      (!forward && currentIndex > 0)
    ) {
      setForward(forward ? 1 : 0);

      try {
        await createImages(forward);

        // Only proceed with animation if images were created successfully
        // Check if images have valid data URLs (not empty strings)
        setFlipping(true);
        setPhase(1);

        setTimeout(() => setPhase(2), 1000);
        setTimeout(() => setPhase(3), 2000);
        setTimeout(() => {
          setFlipping(false);
          setPhase(0);
          setCurrentIndex((prev) => (forward ? prev + 1 : prev - 1));
        }, 3000);
      } catch (error) {
        console.warn('FlipCard: Failed to create flip animation, falling back to direct transition');
        // Fallback: just change the index without animation
        setCurrentIndex((prev) => (forward ? prev + 1 : prev - 1));
      }
    }
  };

  const createImages = async (forward) => {
    const currentCard = contentRef.current?.querySelector('#currentCard');
    const nextCard = forward
      ? hiddenContentRef.current?.querySelector('#nextCard')
      : hiddenContentRef.current?.querySelector('#prevCard');

    if (currentCard && nextCard) {
      try {
        const currentCanvas = await html2canvas(currentCard, {
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        const nextCanvas = await html2canvas(nextCard, {
          useCORS: true,
          allowTaint: true,
          logging: false,
        });

        // Validate canvas dimensions before cropping
        if (currentCanvas.width === 0 || currentCanvas.height === 0 ||
            nextCanvas.width === 0 || nextCanvas.height === 0) {
          console.warn('FlipCard: Canvas has zero dimensions, skipping flip animation');
          return;
        }

        const left1 = cropImage(currentCanvas, 'left');
        const right1 = cropImage(currentCanvas, 'right');
        const left2 = cropImage(nextCanvas, 'left');
        const right2 = cropImage(nextCanvas, 'right');

        if (left1 && right1 && left2 && right2) {
          setImages({
            left1: left1.toDataURL(),
            right1: right1.toDataURL(),
            left2: left2.toDataURL(),
            right2: right2.toDataURL(),
          });
        }
      } catch (error) {
        console.warn('FlipCard: Error creating images for flip animation', error);
      }
    }
  };

  const cropImage = (canvas, side) => {
    // Validate canvas dimensions
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      console.warn('FlipCard: Invalid canvas dimensions');
      return null;
    }

    const cropWidth = Math.floor(canvas.width / 2);
    const { height } = canvas;

    // Ensure we have valid dimensions
    if (cropWidth <= 0 || height <= 0) {
      console.warn('FlipCard: Crop dimensions are invalid');
      return null;
    }

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = height;
    const croppedCtx = croppedCanvas.getContext('2d');

    if (!croppedCtx) {
      console.warn('FlipCard: Could not get canvas context');
      return null;
    }

    try {
      if (side === 'left') {
        croppedCtx.drawImage(canvas, 0, 0, cropWidth, height, 0, 0, cropWidth, height);
      } else {
        croppedCtx.drawImage(
          canvas,
          cropWidth,
          0,
          cropWidth,
          height,
          0,
          0,
          cropWidth,
          height,
        );
      }
    } catch (error) {
      console.warn('FlipCard: Error drawing image', error);
      return null;
    }

    return croppedCanvas;
  };

  useEffect(() => {
    if (curCardIndex === currentIndex) return;
    if (curCardIndex < currentIndex) handleFlip(false);
    else handleFlip(true);
  }, [curCardIndex]);

  return (
    <div>
      <HiddenContent ref={hiddenContentRef} width={width} height={height}>
        {currentIndex < cards.length - 1 && (
          <div id="nextCard">{cards[currentIndex + 1]}</div>
        )}
        {currentIndex > 0 && <div id="prevCard">{cards[currentIndex - 1]}</div>}
      </HiddenContent>
      <FlipCardContainer ref={contentRef} width={width} height={height}>
        {!flipping && <div id="currentCard">{cards[currentIndex]}</div>}
        {flipping && (
          <ImageContainer>
            <ImageHalf
              side="left2"
              image={images.left2}
              phase={phase}
              forward={forward}
            />
            <ImageHalf
              side="right2"
              image={images.right2}
              phase={phase}
              forward={forward}
            />
            <ImageHalf
              side="left1"
              image={images.left1}
              phase={phase}
              forward={forward}
            />
            <ImageHalf
              side="right1"
              image={images.right1}
              phase={phase}
              forward={forward}
            />
          </ImageContainer>
        )}
      </FlipCardContainer>
    </div>
  );
}

export default FlipCard;
