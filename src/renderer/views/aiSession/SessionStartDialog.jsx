import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sessionApi from '../../api/sessionApi';

export default function SessionStartDialog({ open, onClose, activeQuest, userId }) {
  const [goal, setGoal] = useState('');
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  if (!open) return null;

  const startWithQuest = async () => {
    setStarting(true);
    try {
      const r = await sessionApi.start({
        userId,
        questId: activeQuest?.id || null,
        goal: activeQuest?.title || goal || 'Open study session',
      });
      onClose?.();
      navigate(`/ai-session/${r.sessionId}`);
    } catch (e) {
      setStarting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 480, width: '90%' }}>
        <h2 style={{ marginTop: 0 }}>Start an AI session</h2>
        {activeQuest ? (
          <>
            <div style={{ marginBottom: 16 }}>
              Active Quest: <strong>{activeQuest.title}</strong>
            </div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
              The AI will conduct a study session toward this Quest&apos;s goal.
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>No active Quest. Set a session goal:</div>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="What do you want from this session?"
              style={{ width: '100%', padding: 8, marginBottom: 16, fontSize: 14 }}
            />
          </>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={starting}>Cancel</button>
          <button onClick={startWithQuest} disabled={starting || (!activeQuest && !goal.trim())}>
            {starting ? 'Starting...' : 'Start session'}
          </button>
        </div>
      </div>
    </div>
  );
}
