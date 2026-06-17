// src/main/brain/spine/slices/currentBook.js
const BrainContext = require('../BrainContext');

BrainContext.registerSlice('currentBook', async (_userId, override) => {
  if (override && override.bookId != null) return override;
  return { present: false };
});
