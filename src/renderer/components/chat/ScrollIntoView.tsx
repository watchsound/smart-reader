import { ReactNode, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';

function ScrollIntoView({ children }: { children: ReactNode }) {
  // Scroll into view as soon as we appear
  const myRef = useRef(null);
  useEffect(() => {
    if (myRef.current) myRef.current.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return <Box ref={myRef}>{children}</Box>;
}

export default ScrollIntoView;
