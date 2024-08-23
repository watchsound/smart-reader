import React from 'react';

function ContextMenu({ x, y, onDelete }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x,
        zIndex: 1000,
        backgroundColor: 'white',
        border: '1px solid black',
        padding: '10px',
      }}
    >
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        <li style={{ cursor: 'pointer' }} onClick={onDelete}>
          Delete Link
        </li>
      </ul>
    </div>
  );
}

export default ContextMenu;
