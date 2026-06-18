/**
 * argumentXrayApi — renderer wrapper for the Argument Skeleton X-ray
 * (#13) IPC channel. Sends a paragraph + token to the main-process
 * service and gets back {claims, evidence} arrays of verbatim phrases
 * to highlight.
 */

const { ipcRenderer } = window.electron || {};

// eslint-disable-next-line import/prefer-default-export
export const analyzeParagraph = async (paragraph, token) => {
  if (!ipcRenderer) {
    return { claims: [], evidence: [], error: 'ipc unavailable' };
  }
  const result = await ipcRenderer.invoke('argument-xray-analyze', {
    paragraph,
    token,
  });
  return result || { claims: [], evidence: [] };
};
