export const getIframeDoc = () => {
  const pageArea = document.getElementById('page-area');

  if (!pageArea) return null;
  const iframe = pageArea.getElementsByTagName('iframe')[0];
  if (!iframe) return null;
  const doc = iframe.contentDocument;

  if (!doc) {
    return null;
  }
  return doc;
};
export const getPDFIframeDoc = () => {
  const pageArea = document.getElementById('page-area');
  if (!pageArea) return null;
  const iframe = pageArea.getElementsByTagName('iframe')[0];
  if (!iframe) return null;
  const iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  if (!iWin) return null;
  return iWin;
};
