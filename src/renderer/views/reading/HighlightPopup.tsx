import React from 'react';
import type { ViewportHighlight } from 'react-pdf-highlighter-extended-x2';

import './HighlightPopup.css';
import { CommentedHighlight } from './types';

interface HighlightPopupProps {
  highlight: ViewportHighlight<CommentedHighlight>;
}

function HighlightPopup({ highlight }: HighlightPopupProps) {
  const emoji = (highlight as any).emoji || (highlight as any).comment?.emoji;
  const summary = highlight.summary || (highlight as any).comment?.text;

  return (
    <div className="Highlight__popup">
      {emoji && <span className="Highlight__popup-emoji">{emoji}</span>}
      {summary ? summary : 'No comment'}
    </div>
  );
}

export default HighlightPopup;
