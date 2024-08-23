import React, { useState } from 'react';

interface CommentFormProps {
  onSubmit: (
    title?: string,
    summary?: string,
    highlightType?: string,
    color?: string,
    emoji?: string,
  ) => void;
  title?: string;
  summary?: string;
  highlightType?: string;
  color?: string;
  emoji?: string;
}

function CommentForm({
  onSubmit,
  title,
  summary,
  highlightType,
  color,
  emoji,
}: CommentFormProps) {
  const [title0, setTitle0] = useState<string>('');
  const [summary0, setSummary0] = useState<string>('');
  const [highlight, setHighlight] = useState<string>('');
  const [color0, setColor0] = useState<string>('');
  const [emoji0, setEmoji0] = useState<string>('');

  React.useEffect(() => {
    setTitle0(title || '');
    setSummary0(summary || '');
    setHighlight(highlightType || 'highlight');
    setColor0(color || 'info');
    setEmoji0(emoji || '');
  }, [title, summary, highlightType, color, emoji]);

  const handleHighlightChange = (event: { target: { value: any } }) => {
    setHighlight(event.target.value || 'highlight');
  };
  const handleColorChange = (event: { target: { value: any } }) => {
    setColor0(event.target.value || 'info');
  };

  return (
    <form
      className="Tip__card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(title0, summary0, highlight, color0, emoji0);
      }}
    >
      <div>
        <textarea
          placeholder={title0}
          rows={1}
          onChange={(event) => {
            setTitle0(event.target.value);
          }}
        />
      </div>
      <div>
        <textarea
          placeholder={summary0}
          autoFocus
          onChange={(event) => {
            setSummary0(event.target.value);
          }}
        />
      </div>
      <div>
        <select value={highlight} onChange={handleHighlightChange}>
          <option value="">Select an Highlight Type</option>
          <option value="highlight">Highlight</option>
          <option value="underline">UnderLine</option>
          <option value="dashline">Dash Line</option>
          <option value="strokeline">Stroke Line</option>
        </select>
      </div>
      <div>
        <select value={color0} onChange={handleColorChange}>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="info">Information</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>
      <div>
        {['💩', '😱', '😍', '🔥', '😳', '⚠️'].map((_emoji) => (
          <label key={_emoji}>
            <input
              checked={emoji0 === _emoji}
              type="radio"
              name="emoji"
              value={_emoji}
              onChange={(event) => setEmoji0(event.target.value)}
            />
            {_emoji}
          </label>
        ))}
      </div>
      <div>
        <input type="submit" value="Save" />
      </div>
    </form>
  );
}

export default CommentForm;
