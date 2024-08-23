import React from 'react';
import type { ViewportHighlight } from 'react-pdf-highlighter-extended-x2';

import './HighlightPopup.css';
import { CommentedHighlight } from './types';

interface HighlightPopupProps {
  highlight: ViewportHighlight<CommentedHighlight>;
}

function HighlightPopup({ highlight }: HighlightPopupProps) {
  return highlight.summary ? (
    <div className="Highlight__popup">{highlight.summary}</div>
  ) : (
    <div className="Highlight__popup">Comment has no Text</div>
  );
}

export default HighlightPopup;
