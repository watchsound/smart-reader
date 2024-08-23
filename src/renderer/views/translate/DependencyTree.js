import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/system';

const Token = styled('div')(({ theme }) => ({
  display: 'inline-block',
  margin: '0 4px',
  padding: '2px 4px',
  border: '1px solid',
  borderRadius: '4px',
  position: 'relative',
}));

const Annotation = styled('div')(({ theme }) => ({
  position: 'relative',
  marginBottom: '20px',
}));

const Arrow = styled('svg')(({ theme }) => ({
  position: 'absolute',
  overflow: 'visible',
}));

/**
 *  tokens: [
    { text: 'Mary', tag: 'NNP' },
    { text: 'was', tag: 'VBD' },
    { text: 'born', tag: 'VBN' },
    { text: 'in', tag: 'IN' },
    { text: 'Paris', tag: 'NNP' },
    { text: '.', tag: '.' }
  ],
  dependencies: [
    { from: 1, to: 0, label: 'nsubj:pass' },
    { from: 1, to: 2, label: 'aux:pass' },
    { from: 2, to: 4, label: 'obl' },
    { from: 4, to: 3, label: 'case' },
    { from: 4, to: 5, label: 'punct' }
  ]
 */

function DependencyTree({ tokens, dependencies }) {
  const [positions, setPositions] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    const updatePositions = () => {
      const container = containerRef.current;
      if (!container) return;

      const tokenElements = container.querySelectorAll('.token');
      const newPositions = Array.from(tokenElements).map((el) => {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return {
          left: rect.left - containerRect.left + rect.width / 2,
          top: rect.top - containerRect.top, // + rect.height,
        };
      });
      setPositions(newPositions);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [tokens]);

  return (
    <Box ref={containerRef}>
      <Annotation>
        {tokens.map((token, index) => (
          <Token
            key={index}
            id={`token-${index}`}
            className="token"
            sx={{ backgroundColor: token.color }}
          >
            <Typography variant="subtitle2">{token.text}</Typography>
            {Array.isArray(token.tag) &&
              token.tag.map((t, i) => {
                return (
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {t}
                  </Typography>
                );
              })}
            {!Array.isArray(token.tag) && (
              <Typography variant="caption">{token.tag}</Typography>
            )}
          </Token>
        ))}
        {dependencies.map((dep, index) => {
          if (!positions[dep.from - 1] || !positions[dep.to - 1]) return null;
          const fromPos = positions[dep.from - 1];
          const toPos = positions[dep.to - 1];
          const startX = fromPos.left;
          const startY = fromPos.top;
          const endX = toPos.left;
          const endY = toPos.top;

          const controlPointX = (startX + endX) / 2;
          const controlPointY = Math.min(startY, endY) - 40 - index * 10; // Adjust control point for better curves

          return (
            <Arrow
              key={index}
              className="arrow"
              style={{ left: 0, top: 0, width: '100%', height: '100%' }}
            >
              <path
                d={`M${startX},${startY} Q${controlPointX},${controlPointY} ${endX},${endY}`}
                stroke="black"
                fill="transparent"
                strokeWidth="1"
                markerEnd="url(#arrowhead)"
              />
              {/**
              <text
                x={controlPointX}
                y={controlPointY - 5}
                fill="black"
                textAnchor="middle"
              >
                {dep.label}
              </text>
               */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="0"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="black" />
                </marker>
              </defs>
            </Arrow>
          );
        })}
      </Annotation>
    </Box>
  );
}

// const NLPAnnotationVisualizer = () => {
//   return (
//     <Box>
//       <Typography variant="h5">NLP Annotation Visualization</Typography>
//       <DependencyTree data={annotationData} />
//     </Box>
//   );
// };

export default DependencyTree;
