import React, { useState, useRef } from 'react';
// import html2canvas from 'html2canvas';

function AreaCapture({ children, useCapture, onCaptureComplete }) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [rect, setRect] = useState(null);
  const screenRef = useRef(null);

  const handleMouseDown = (e) => {
    if (!useCapture) return;
    const r = screenRef.current.getBoundingClientRect();
    setIsSelecting(true);
    setStartPoint({ x: e.clientX - r.left, y: e.clientY - r.top });
    setRect(null);
  };

  const handleMouseMove = (e) => {
    if (!useCapture) return;
    if (!isSelecting) return;
    const r = screenRef.current.getBoundingClientRect();
    const currentX = e.clientX - r.left;
    const currentY = e.clientY - r.top;
    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);
    const newX = currentX < startPoint.x ? currentX : startPoint.x;
    const newY = currentY < startPoint.y ? currentY : startPoint.y;
    setRect({ x: newX, y: newY, width, height });
  };

  const handleMouseUp = async () => {
    if (!useCapture) return;
    setIsSelecting(false);
    if (rect) {
      // Temporarily hide the overlay
      const overlay = document.getElementById('capture-overlay');
      if (overlay) overlay.style.display = 'none';
      const r = screenRef.current.getBoundingClientRect();
      const x = rect.x + r.left;
      const y = rect.y + r.top;

      const imageData = await window.electron.ipcRenderer.captureArea({
        x,
        y,
        width: rect.width,
        height: rect.height,
      });
      setIsSelecting(false);
      setStartPoint({ x: 0, y: 0 });
      setRect(null);
      onCaptureComplete(imageData);
      if (overlay) overlay.style.display = 'block';
    }
  };

  return (
    <div
      ref={screenRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        border: '1px solid black',
        position: 'relative',
        cursor: 'crosshair',
      }}
    >
     {children}

      {useCapture && (
        <div
          id="capture-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.1)', // Semi-transparent gray overlay
            // pointerEvents: 'none', // Allows mouse events to pass through to children
            display: 'block',
          }}
        />
      )}
      {rect && useCapture && (
        <div
          style={{
            position: 'absolute',
            border: '2px dashed red',
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            zIndex: 1001,
          }}
        />
      )}


    </div>
  );
}

export default AreaCapture;
