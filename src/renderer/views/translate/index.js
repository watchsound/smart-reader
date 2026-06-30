/* eslint-disable prettier/prettier */
import React from 'react';

import TranslateShell from './TranslateShell';

// Override .main { min-height: 98vh } from globals.css — that rule predates
// the AppBar-aware Outlet container (Root.jsx:599 sets height to
// calc(100vh - 64px)). The 98vh wrapper used to push the input panel below
// the visible area regardless of window size. We pin the wrapper to its
// parent's actual height instead.
function TranslatePage() {
  return (
    <div
      className="main note__main"
      style={{ minHeight: 0, height: '100%', padding: 0 }}
    >
      <TranslateShell />
    </div>
  );
}
export default TranslatePage;
