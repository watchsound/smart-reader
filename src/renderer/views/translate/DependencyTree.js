import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';

const TokenContainer = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  margin: '0 6px',
  position: 'relative',
}));

const TokenBox = styled(Box)(({ theme, bgcolor }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 8,
  backgroundColor: bgcolor || alpha(theme.palette.primary.main, 0.08),
  border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
  transition: 'all 0.2s ease',
  position: 'relative',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.1)}`,
  },
}));

const TagBadge = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2px 8px',
  borderRadius: 4,
  backgroundColor: alpha(theme.palette.text.primary, 0.06),
  marginTop: 4,
  maxWidth: '100%',
}));

const Annotation = styled(Box)(({ theme }) => ({
  position: 'relative',
  marginBottom: 20,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'flex-end',
  gap: 4,
}));

const Arrow = styled('svg')(({ theme }) => ({
  position: 'absolute',
  overflow: 'visible',
  pointerEvents: 'none',
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
  const theme = useTheme();
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
          top: rect.top - containerRect.top,
        };
      });
      setPositions(newPositions);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [tokens]);

  // Color coding for different POS tags
  const getTagColor = (tag) => {
    const tagStr = String(tag).toUpperCase();
    if (tagStr.startsWith('NN') || tagStr.startsWith('PRP')) {
      return alpha(theme.palette.info.main, 0.15);
    }
    if (tagStr.startsWith('VB') || tagStr.startsWith('MD')) {
      return alpha(theme.palette.error.main, 0.15);
    }
    if (tagStr.startsWith('JJ') || tagStr.startsWith('RB')) {
      return alpha(theme.palette.warning.main, 0.15);
    }
    if (tagStr.startsWith('IN') || tagStr.startsWith('TO') || tagStr.startsWith('CC')) {
      return alpha(theme.palette.success.main, 0.15);
    }
    if (tagStr.startsWith('DT') || tagStr.startsWith('POS')) {
      return alpha(theme.palette.secondary.main, 0.15);
    }
    return alpha(theme.palette.primary.main, 0.08);
  };

  return (
    <Box ref={containerRef} sx={{ py: 2 }}>
      <Annotation>
        {tokens.map((token, index) => (
          <TokenContainer key={index}>
            <TokenBox
              className="token"
              bgcolor={token.color || getTagColor(token.tag)}
              sx={{
                minWidth: 50,
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  textAlign: 'center',
                }}
              >
                {token.text}
              </Typography>
            </TokenBox>
            {token.tag && (
              <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                {Array.isArray(token.tag) ? (
                  token.tag.map((t, i) => (
                    <TagBadge key={i}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          color: theme.palette.text.secondary,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t}
                      </Typography>
                    </TagBadge>
                  ))
                ) : (
                  <TagBadge>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 500,
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {token.tag}
                    </Typography>
                  </TagBadge>
                )}
              </Box>
            )}
          </TokenContainer>
        ))}

        {/* Dependency arrows */}
        {dependencies.length > 0 && positions.length > 0 && (
          <Arrow
            style={{
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              position: 'absolute',
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="0"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon
                  points="0 0, 8 3, 0 6"
                  fill={theme.palette.text.secondary}
                />
              </marker>
              <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity="0.6" />
                <stop offset="100%" stopColor={theme.palette.secondary.main} stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {dependencies.map((dep, index) => {
              if (!positions[dep.from - 1] || !positions[dep.to - 1]) return null;
              const fromPos = positions[dep.from - 1];
              const toPos = positions[dep.to - 1];
              const startX = fromPos.left;
              const startY = fromPos.top;
              const endX = toPos.left;
              const endY = toPos.top;

              const controlPointX = (startX + endX) / 2;
              const controlPointY = Math.min(startY, endY) - 35 - index * 12;

              return (
                <g key={index}>
                  <path
                    d={`M${startX},${startY} Q${controlPointX},${controlPointY} ${endX},${endY}`}
                    stroke="url(#arrowGradient)"
                    fill="transparent"
                    strokeWidth="2"
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead)"
                    style={{
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
                    }}
                  />
                  {dep.label && (
                    <text
                      x={controlPointX}
                      y={controlPointY - 6}
                      fill={theme.palette.text.secondary}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {dep.label}
                    </text>
                  )}
                </g>
              );
            })}
          </Arrow>
        )}
      </Annotation>
    </Box>
  );
}

export default DependencyTree;
