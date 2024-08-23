/* eslint-disable promise/valid-params */
/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { EpubView } from 'react-reader';
import html2canvas from 'html2canvas';

const cardWidth = 360;
/**
 * FIXME ----- not not work,   file object can not be mapped to url ??
 */
function EpubCoverView({ epubFile, setFirstPageScreenshot }) {
  // const [useCapture, setUseCapture] = useState(false);
  const captureScreenshot = () => {
   // Get iframe element
    const iframe = document.querySelector('iframe');
    if (!iframe) return;
    iframe.contentWindow.scrollTo(0, 0);
    html2canvas(iframe.contentDocument.body).then((canvas) => {
      const ratio = cardWidth / canvas.width;
      canvas.width = cardWidth;
      canvas.height *= ratio;
      const dataUrl = canvas.toDataURL("image/png");
      setFirstPageScreenshot(dataUrl);
      return true;
    }).catch((e) =>{
      return false;
    } );
  };
  // const onCaptureComplete = (data) => {
  //   setUseCapture(false);
  // };
  const handlePageChange = (pageNumber) => {
    if (pageNumber === 1) {
      captureScreenshot();
    }
  };
  return (
    <EpubView
        url={URL.createObjectURL(epubFile)}
        loadingView={<div>Loading...</div>}
        errorView={<div>Error loading EPUB file</div>}
        onPageChange={handlePageChange}
      />
  );
}

export default EpubCoverView;
