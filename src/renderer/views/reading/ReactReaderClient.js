import React, { useState } from 'react';

// import dynamic from "next/dynamic";
// export const  ReactReader  = dynamic(() => import( 'react-reader'), {
// ssr: false,
// } );
import { ReactReader } from 'react-reader';

export default function ReactReaderClient() {
  const [location, setLocation] = useState(0);

  //  useEffect(() => {
  //   const { ReactReader } = await import('react-reader')
  // },[]);

  return (
    <div style={{ height: '100vh' }}>
      <ReactReader
        url="https://react-reader.metabits.no/files/alice.epub"
        location={location}
        locationChanged={(epubcfi) => setLocation(epubcfi)}
      />
    </div>
  );
}
