/* eslint-disable import/prefer-default-export */
export function getParamsFromUrl() {
  const hashParams = {};
  let e;
  const r = /([^&;=]+)=?([^&;]*)/g;
  const q =
    window.location.hash.substring(2) ||
    window.location.search.substring(1).split('#')[0];

  while ((e = r.exec(q))) {
    hashParams[e[1]] = decodeURIComponent(e[2]);
  }
  return hashParams;
}

export function adjustFontSize({
  text,
  maxWidth,
  maxHeight,
  defaultFontSize = 18,
}) {
  let currentSize = defaultFontSize;

  // Temporarily append the text to measure its size without changing the DOM
  const tempText = document.createElement('div');
  tempText.style.fontSize = `${currentSize}px`;
  tempText.style.fontFamily = 'Arial, sans-serif'; // Match the font style you use
  tempText.style.width = `${maxWidth}px`;
  tempText.style.position = 'absolute';
  tempText.style.visibility = 'hidden';
  tempText.innerText = text;
  document.body.appendChild(tempText);

  // Reduce font size until the text fits or reaches a minimum font size
  while (tempText.clientHeight > maxHeight && currentSize > 10) {
    currentSize--;
    tempText.style.fontSize = `${currentSize}px`;
  }

  document.body.removeChild(tempText);
  return currentSize;
}
