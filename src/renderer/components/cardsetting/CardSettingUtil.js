export default function decomposeHTML(html, checkTitle) {
  // Parse the HTML string into a document
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const { body } = doc;

  const chunks = [];
  let title = '';
  let currentChunk = '';

  function addChunk(chunk) {
    if (chunk && chunk.trim()) {
      chunks.push(chunk.trim());
    }
  }

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    const nodeName = node.nodeName.toLowerCase();

    if (i === 0 && checkTitle) {
      if (nodeName.startsWith('h')) {
        title = node.innerHTML || '';
        continue;
      }
      if (nodeName.startsWith('p') && node.innerHTML.length < 20) {
        title = node.innerHTML || '';
        continue;
      }
    }

    if (nodeName === 'p') {
      // If the current node is <p>, add it as a chunk
      addChunk(currentChunk);
      currentChunk = node.innerHTML || '';
      addChunk(currentChunk);
      currentChunk = '';
    } else if (nodeName === 'ul') {
      // If the current node is <ul>, add it as a chunk
      addChunk(currentChunk);
      currentChunk = node.outerHTML || '';
      addChunk(currentChunk);
      currentChunk = '';
    } else if (nodeName.startsWith('h')) {
      // If the current node is a heading (h1, h2, etc.)
      const nextNode = body.childNodes[i + 1];
      if (nextNode && nextNode.nodeName.toLowerCase().startsWith('h')) {
        // If the next node is also a heading, add the current heading as a chunk
        addChunk(currentChunk);
        currentChunk = node.innerHTML || '';
        addChunk(currentChunk);
        currentChunk = '';
      } else {
        // Otherwise, start a new chunk with the current heading
        addChunk(currentChunk);
        currentChunk = node.innerHTML || '';
      }
    } else {
      // For any other nodes, append to the current chunk
      currentChunk += node.innerHTML || '';
    }
  }
  addChunk(currentChunk);

  return { title, chunks };
}

export function stripLeadingAndEndingTags(htmlString) {
  // Use a regular expression to match the leading tag
  const leadingTagPattern = /^<(\w+)([^>]*)>/;
  // Use a regular expression to match the ending tag
  const endingTagPattern = /<\/(\w+)>$/;

  // Remove the leading tag
  htmlString = htmlString.replace(leadingTagPattern, '');

  // Remove the ending tag
  htmlString = htmlString.replace(endingTagPattern, '');

  return htmlString;
}

// Example usage:
// const htmlInput = '<div><h1>This is a heading</h1><p>This is a paragraph.</p><div>This is a div.</div></div>';
// const strippedHtml = stripLeadingAndEndingTags(htmlInput);
// console.log(strippedHtml);
