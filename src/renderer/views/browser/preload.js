const { ipcRenderer } = require('electron');

let isDragging = false;

document.addEventListener('mousedown', () => {
  isDragging = false; // Reset the flag on mouse down
});

document.addEventListener('mousemove', () => {
  isDragging = true; // Set the flag on mouse move, indicating a drag might be happening
});

document.addEventListener('mouseup', (event) => {
  const selectedText = window.getSelection().toString().trim();
  console.log(selectedText);
  if (selectedText.length > 2 && isDragging) {
    event.preventDefault();
    let useKeyword = false;
    const p0 = selectedText.indexOf(' ');
    if (p0 < 0) useKeyword = true;
    else {
      const p1 = selectedText.indexOf(' ', p0 + 2);
      if (p1 < 0) useKeyword = true;
      else {
        const p2 = selectedText.indexOf(' ', p1 + 2);
        if (p2 < 0) useKeyword = true;
      }
    }
    if (useKeyword) {
      ipcRenderer.send('show-context-menu-from-word', {
        selectedText,
        x: event.clientX,
        y: event.clientY,
      });
    } else {
      // Send the selected text to the main process only if there's a selection
      // and it's after a drag event, making it more specific to text selection.
      // ipcRenderer.send('selected-text', selectedText);
      ipcRenderer.send('show-context-menu-from-selection', {
        selectedText,
        x: event.clientX,
        y: event.clientY,
      });
    }
  }
});

document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  ipcRenderer.send('show-context-menu-regular', {
    content: '',
    x: event.clientX,
    y: event.clientY,
  });
  //  }
});



// In preload.js or a renderer script
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img').forEach((img) => {
    img.addEventListener('contextmenu', (event) => {
      // if (event.shiftKey) {
      // Check if the Shift key was pressed
      event.preventDefault(); // Prevent the default context menu
      const imageUrl = event.target.src;
      // For simplicity, this example uses console.log
      // In an actual app, you might send this to the main process via ipcRenderer
      console.log('Image selected:', imageUrl);
      ipcRenderer.send('show-image-context-menu', {
        imageUrl,
        x: event.clientX,
        y: event.clientY,
      });
      // }
    });
  });
});
