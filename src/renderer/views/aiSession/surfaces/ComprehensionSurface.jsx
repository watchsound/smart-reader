import React, { useState } from 'react';

export default function ComprehensionSurface({ args, onSubmit }) {
  const [answer, setAnswer] = useState('');

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h2>Comprehension check</h2>
      <div style={{ color: '#666', marginBottom: 12 }}>
        Book {args.bookId}, chapter {args.chapterId}
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={6}
        style={{ width: '100%', padding: 8, fontSize: 14, marginBottom: 12 }}
        placeholder="Summarize the key idea of this chapter..."
      />
      <button onClick={() => onSubmit({ answer, durationMs: 0 })} disabled={!answer.trim()}>
        Submit
      </button>
    </div>
  );
}
