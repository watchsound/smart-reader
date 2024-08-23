// (function() {
//     function getTextContentWithTags(element) {
//     let texts = [];
//     let currentText = '';

//     function addText(type, text) {
//         if (type === 'text') {
//             currentText += text;
//             while (currentText.length >= 3200) { // Process in chunks if over 700 characters
//                 let splitIndex = findSplitIndex(currentText, 3000, 200);
//                 texts.push({ type: 'text', data: currentText.slice(0, splitIndex) });
//                 currentText = currentText.slice(splitIndex);
//             }
//         }
//     }

//     function flushText() {
//         if (currentText.length > 0) {
//             texts.push({ type: 'text', data: currentText });
//             currentText = '';
//         }
//     }

//     function findSplitIndex(text, base, tolerance) {
//         let start = Math.max(0, base - tolerance);
//         let end = Math.min(text.length, base + tolerance);
//         for (let i = end; i > start; i--) {
//             if (['.', '!', '?'].includes(text[i])) {
//                 return i + 1;
//             }
//         }
//         return base; // Fallback to base if no sentence boundary is found
//     }

//     function traverseNodes(node) {
//         if (node.nodeType === Node.TEXT_NODE) {
//             addText('text', node.textContent);
//         } else if (node.nodeType === Node.ELEMENT_NODE) {
//             const tag = node.tagName.toLowerCase();
//             if (tag === 'script') {
//                 flushText();  // Flush any accumulated text before adding a script
//                 texts.push({ type: 'code', data: node.outerHTML });
//             } else {
//                 let attributes = '';
//                 Array.from(node.attributes).forEach(attr => {
//                     attributes += ' ' + attr.name + '="' + attr.value + '"';
//                 });
//                 addText('text', '<' + tag + attributes + '>');
//                 Array.from(node.childNodes).forEach(traverseNodes);
//                 addText('text', '</' + tag + '>');
//             }
//         }
//     }

//     traverseNodes(element);
//     flushText();  // Flush any remaining text
//     return texts;
// }

//  return getTextContentWithTags(document.body);
// })();


