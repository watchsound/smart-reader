import React, { useEffect, useRef, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import { commitMaskAttempt } from './maskAttempt';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
`;

function MaskedToken({ expected, accent, onResolved }) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | wrong | revealed | correct
  const [hint, setHint] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const inputRef = useRef(null);

  const widthCh = Math.max(expected.length, 3);

  // Live prefix-match feedback while typing (status === 'idle').
  const trimmed = value.trim();
  const expectedLower = expected.toLowerCase();
  const livePrefixOk =
    trimmed.length > 0 &&
    expectedLower.startsWith(trimmed.toLowerCase());
  const liveFullMatch =
    trimmed.length > 0 && trimmed.toLowerCase() === expectedLower;
  const liveWrong = trimmed.length > 0 && !livePrefixOk;

  // Auto-resolve when the typed value exactly matches expected — no Tab needed.
  useEffect(() => {
    if (liveFullMatch && status === 'idle') {
      setStatus('correct');
      setHint(null);
      if (onResolved) onResolved('correct');
    }
  }, [liveFullMatch, status, onResolved]);

  const handleCommit = () => {
    if (status === 'correct' || status === 'revealed') return;
    const result = commitMaskAttempt(value, expected);
    if (result.ok) {
      setStatus('correct');
      setHint(null);
      if (onResolved) onResolved('correct');
      return;
    }
    if (!value) return;
    const nextWrong = wrongCount + 1;
    setWrongCount(nextWrong);
    setHint(result.hint);
    if (nextWrong >= 2) {
      setStatus('revealed');
      setValue(expected);
      if (onResolved) onResolved('revealed');
    } else {
      setStatus('wrong');
      setTimeout(() => setStatus('idle'), 200);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      handleCommit();
    }
  };

  const peek = (e) => {
    e.stopPropagation();
    setStatus('revealed');
    setValue(expected);
    if (onResolved) onResolved('revealed');
  };

  const isResolved = status === 'correct' || status === 'revealed';
  const resolvedColor =
    status === 'revealed' ? theme.palette.warning.main : accent;

  // Border color reflects live state for unresolved tokens.
  let borderColor = alpha(accent, 0.6);
  if (liveWrong) borderColor = theme.palette.error.main;
  else if (livePrefixOk) borderColor = theme.palette.success.main;

  // Background tint similarly nudges left-right when typing.
  let bgColor = alpha(accent, 0.1);
  if (liveWrong) bgColor = alpha(theme.palette.error.main, 0.08);
  else if (livePrefixOk) bgColor = alpha(theme.palette.success.main, 0.1);

  return (
    <Tooltip
      title={
        isResolved ? '' : hint || 'Type the missing word — match auto-confirms'
      }
      placement="top"
      arrow
      enterDelay={400}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'baseline',
          mx: '2px',
          px: '6px',
          minWidth: `${widthCh}ch`,
          borderRadius: '6px',
          backgroundColor: isResolved ? alpha(accent, 0.1) : bgColor,
          borderBottom: isResolved
            ? `1.5px solid ${resolvedColor}`
            : `1.5px dashed ${borderColor}`,
          color: isResolved ? resolvedColor : theme.palette.text.primary,
          fontWeight: isResolved ? 600 : 500,
          fontFamily: isResolved ? 'inherit' : MONO,
          animation: status === 'wrong' ? `${shake} 150ms ease-in-out` : 'none',
          transition: 'background-color 150ms ease-out, border-color 150ms ease-out',
          position: 'relative',
        }}
      >
        <input
          ref={inputRef}
          value={value}
          disabled={isResolved}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKey}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            width: `${widthCh}ch`,
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
            fontWeight: 'inherit',
            textAlign: isResolved ? 'left' : 'center',
            cursor: isResolved ? 'default' : 'text',
          }}
          aria-label={
            // eslint-disable-next-line no-nested-ternary
            isResolved
              ? `revealed: ${expected}`
              : hint
                ? `try again. Hint: ${hint}`
                : 'masked word'
          }
        />
        {!isResolved && (
          <VisibilityIcon
            onClick={peek}
            sx={{
              fontSize: 12,
              ml: 0.5,
              cursor: 'pointer',
              opacity: 0.5,
              '&:hover': { opacity: 1 },
            }}
            aria-label="reveal this word"
          />
        )}
      </Box>
    </Tooltip>
  );
}

export default MaskedToken;
