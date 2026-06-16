/* eslint-disable no-restricted-syntax */
/* eslint-disable promise/no-callback-in-promise */
export default function parseMarkdownToHtml(markdown, callback) {
  const t = window.electron.ipcRenderer.parseMarkdown(markdown);
  // eslint-disable-next-line promise/catch-or-return, promise/always-return
  t.then((result) => {
    setTimeout(() => {
      callback(result);
    }, 0);
  });
}

export function parseMarkdownToHtmlNoCallback(markdown) {
  return window.electron.ipcRenderer.parseMarkdown(markdown);
}

function areAllNullOrUndefined(obj) {
  if (!obj) return true;
  for (const key in obj) {
    if (obj[key] !== null && obj[key] !== undefined) {
      return false;
    }
  }
  return true;
}

export function removeEmptyPages(cards) {
  for (let i = 0; i < cards.length; i++) {
    if (areAllNullOrUndefined(cards[i])) delete cards[i];
  }
  return cards;
}

export function removeEmptySide(threeSides) {
  if (
    threeSides[0].length === 0 &&
    threeSides[1].length === 0 &&
    threeSides[2].length === 0
  )
    return threeSides;
  if (threeSides[0].length === 0) {
    if (threeSides[1].length === 0) {
      threeSides[0] = threeSides[2];
    } else {
      threeSides[0] = threeSides[1];
      threeSides[1] = threeSides[2];
    }
  } else if (threeSides[1].length === 0) {
    threeSides[1] = threeSides[2];
  }
  return threeSides;
}
