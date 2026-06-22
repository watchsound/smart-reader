// src/renderer/components/MoodBoard/diagram/ImageNodeWidget.tsx
import * as React from 'react';
import { ImageNodeModel } from './ImageNodeModel';

export interface ImageNodeWidgetProps {
  node: ImageNodeModel;
  engine: { repaintCanvas: () => void } | unknown;
}

function ImageNodeWidget({ node }: ImageNodeWidgetProps) {
  return (
    <div
      data-testid="image-node-outer"
      style={{
        width: node.width,
        height: node.height,
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        background: '#eee',
        overflow: 'hidden',
        borderRadius: 8,
        boxSizing: 'border-box',
      }}
    >
      {node.src ? (
        <img
          src={node.src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          data-testid="image-node-placeholder"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#777',
            fontSize: 12,
          }}
        >
          paste / drop an image
        </div>
      )}
    </div>
  );
}

export default ImageNodeWidget;
