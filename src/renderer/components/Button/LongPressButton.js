import React, { useState, useRef } from 'react';
import IconButton from '@mui/material/IconButton';

function LongPressButton({
  handleNormalPress,
  handleLongPress,
  disabled,
  IconComponent,
}) {
  const [isLongPress, setIsLongPress] = useState(false);
  const timerRef = useRef(null);
  const buttonRef = useRef();

  const handleMouseDown = (e) => {
    if (!e.currentTarget && buttonRef.current)
      e.currentTarget = buttonRef.current;
    timerRef.current = setTimeout(() => {
      setIsLongPress(true);
      handleLongPress(e);
    }, 500); // Adjust the duration for long press here
  };

  const handleMouseUp = (e) => {
    if (!e.currentTarget && buttonRef.current)
      e.currentTarget = buttonRef.current;
    if (!isLongPress) {
      handleNormalPress(e);
    }
    clearTimeout(timerRef.current);
    setIsLongPress(false);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    setIsLongPress(false);
  };

  return (
    <IconButton
      ref={buttonRef}
      size="small"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      aria-label="bookmark"
    >
      <IconComponent fontSize="small" />
    </IconButton>
  );
}

export default LongPressButton;
