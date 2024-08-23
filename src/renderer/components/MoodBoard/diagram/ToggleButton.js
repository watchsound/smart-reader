import React, { useState } from 'react';
import { IconButton, SvgIcon } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';

function ToggleButton({ onToggle, iconActive, iconInactive, labelActive, labelInactive, title }) {
  // State to manage the toggle
  const [isActive, setIsActive] = useState(false);

  // Function to handle button click
  const handleClick = () => {
    setIsActive(!isActive); // Toggle the state
    onToggle(!isActive);    // Invoke the callback with the new state
  };

  // Select the correct icon and label based on the state
  const Icon = isActive ? iconActive : iconInactive;
  const label = isActive ? labelActive : labelInactive;

  return (
    <Tooltip title="title">
      <IconButton aria-label={label} onClick={handleClick}>
        <SvgIcon component={Icon} />
      </IconButton>
    </Tooltip>
  );
}

export default ToggleButton;
