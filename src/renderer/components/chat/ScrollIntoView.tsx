import { ReactNode, useRef, useEffect } from 'react';
import Card from '@mui/material/Card';

function ScrollIntoView({ children }: { children: ReactNode }) {
  // Scroll into view as soon as we appear
  const myRef = useRef(null);
  useEffect(() => {
    if (myRef.current) myRef.current.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return <Card ref={myRef}>{children}</Card>;
}

export default ScrollIntoView;
