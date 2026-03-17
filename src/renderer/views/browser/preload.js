const { ipcRenderer } = require('electron');

// Expose ipcRenderer globally for injected scripts (like StudyEnhancer)
window.ipcRenderer = ipcRenderer;

// Listen for postMessage from injected scripts (like StudyEnhancer paragraph icons)
// and forward to host renderer
window.addEventListener('message', (event) => {
  console.log('Preload: received message event', event.data);
  if (event.data && event.data.type === 'se-paragraph-action') {
    console.log('Preload: forwarding se-paragraph-action to host');
    ipcRenderer.sendToHost('show-context-menu', {
      menuType: event.data.menuType,
      selectedText: event.data.selectedText,
      paragraphId: event.data.paragraphId,
      x: event.data.x,
      y: event.data.y,
    });
  }
});

// Also listen for custom events (alternative communication method)
document.addEventListener('se-paragraph-action', (event) => {
  console.log('Preload: received custom event se-paragraph-action', event.detail);
  if (event.detail) {
    ipcRenderer.sendToHost('show-context-menu', {
      menuType: event.detail.menuType,
      selectedText: event.detail.selectedText,
      paragraphId: event.detail.paragraphId,
      x: event.detail.x,
      y: event.detail.y,
    });
  }
});

let isDragging = false;

document.addEventListener('mousedown', () => {
  isDragging = false; // Reset the flag on mouse down
});

document.addEventListener('mousemove', () => {
  isDragging = true; // Set the flag on mouse move, indicating a drag might be happening
});

// Helper function to send context menu message to parent window
function sendContextMenu(menuType, data) {
  ipcRenderer.sendToHost('show-context-menu', {
    menuType,
    ...data,
  });
}

document.addEventListener('mouseup', (event) => {
  const selectedText = window.getSelection().toString().trim();
  console.log(selectedText);
  if (selectedText.length > 2 && isDragging) {
    event.preventDefault();
    // Determine if it's a single word or multi-word selection
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

    // Send to custom context menu in parent window
    sendContextMenu(useKeyword ? 'word' : 'selection', {
      selectedText,
      x: event.clientX,
      y: event.clientY,
    });
  }
});

document.addEventListener('contextmenu', (event) => {
  // Check if target is an image
  if (event.target.tagName === 'IMG') {
    event.preventDefault();
    event.stopPropagation();
    sendContextMenu('image', {
      imageUrl: event.target.src,
      x: event.clientX,
      y: event.clientY,
    });
    return;
  }

  // Check if there's selected text
  const selectedText = window.getSelection().toString().trim();
  if (selectedText.length > 2) {
    event.preventDefault();
    // Determine if it's a single word or multi-word selection
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

    sendContextMenu(useKeyword ? 'word' : 'selection', {
      selectedText,
      x: event.clientX,
      y: event.clientY,
    });
    return;
  }

  // Regular right-click (no selection)
  event.preventDefault();
  sendContextMenu('regular', {
    x: event.clientX,
    y: event.clientY,
  });
});

// Handle dynamically loaded images
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.tagName === 'IMG') {
        node.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          sendContextMenu('image', {
            imageUrl: event.target.src,
            x: event.clientX,
            y: event.clientY,
          });
        });
      }
      // Also check for images within added nodes
      if (node.querySelectorAll) {
        node.querySelectorAll('img').forEach((img) => {
          img.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            sendContextMenu('image', {
              imageUrl: event.target.src,
              x: event.clientX,
              y: event.clientY,
            });
          });
        });
      }
    });
  });
});

// Start observing when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Handle existing images
  document.querySelectorAll('img').forEach((img) => {
    img.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      sendContextMenu('image', {
        imageUrl: event.target.src,
        x: event.clientX,
        y: event.clientY,
      });
    });
  });

  // Observe for new images
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
});
