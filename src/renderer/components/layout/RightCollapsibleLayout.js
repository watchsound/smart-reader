/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import { Button, Slide } from '@mui/material';
import SmallButton from '../Button/SmallButton';

function RightCollapsibleLayout({ mainPanel, rightPanel, heightAdjust, rightPanelWidth, panelOpened }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (typeof panelOpened === 'undefined') return;
    setOpen(panelOpened);
  }, [panelOpened]);

  const togglePanel = (e) => {
    try {
      e.stopPropagation();
		  e.preventDefault();
    } catch (ex) {
      console.log(ex);
    }
    setOpen(!open);
  };

  const panelStyle = {
    height: heightAdjust ? `calc(100vh - ${heightAdjust})` : '100vh',
    overflow: 'auto',
    width: `${rightPanelWidth}px`,
    minWidth: `${rightPanelWidth}px`,
    transition: 'transform  0.3s ease',
    transform: open ? 'translateX(0)' : 'translateX(-100%)'
  };

  const mainContentStyle = {
    flexGrow: 1,
    transition: 'margin-right 0.3s ease',
    marginRight: open ? '0' : '0',// Space for the toggle button
   // width:  open ? `calc(100% -${rightPanelWidth}px)` : '100%',
  };

  const toggleButtonStyle = {
    position: 'absolute',
    top: '70%',
    right:  open ? `${rightPanelWidth}px` : '0',
    transform: 'translateY(-50%) rotate(-90deg)',
    transformOrigin: 'right top',
    backgroundColor: '#ECF0F1FF',
    height: '24px',
    padding: '0 4px',
    zIndex: 1000,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height:  heightAdjust ? `calc(100vh - ${heightAdjust})` : '100vh', display: 'flex'  }}>
      <div style={mainContentStyle}>{mainPanel}</div>
      <SmallButton style={toggleButtonStyle} onClick={togglePanel}>
        {open ? 'Hide Panel' : 'Show Panel'}
      </SmallButton>
      <Slide direction="left" in={open} mountOnEnter unmountOnExit>
        <div style={{ ...panelStyle }}>
          {rightPanel}
        </div>
      </Slide>
    </div>
  );
}

export default RightCollapsibleLayout;
