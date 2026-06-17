/**
 * orbMenuIntegration.test.jsx — smoke test for Task 8 (Phase 10b-2).
 *
 * Verifies that:
 *   1. OrbQuestMenu module loads without import-time errors after the
 *      "Start AI Session" item was added.
 *   2. The "Start AI Session" item is rendered when the menu is open.
 *   3. Clicking it calls the onStartSession callback and closes the menu.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Stub MUI icons so tests don't need the full icon tree
jest.mock('@mui/icons-material/School', () => ({
  __esModule: true,
  default: () => <span data-testid="icon-school" />,
}));

// questApi is used inside OrbQuestMenu to load Quest list — stub it out
jest.mock('../../../renderer/api/questApi', () => ({
  __esModule: true,
  default: {
    list: jest.fn().mockResolvedValue([]),
    getProgress: jest.fn().mockResolvedValue(null),
  },
}));

// NewQuestDialog is imported by OrbQuestMenu — stub so we don't need its deps
jest.mock('../../../renderer/components/brainShell/NewQuestDialog', () => ({
  __esModule: true,
  default: () => null,
}));

// eslint-disable-next-line import/first
import OrbQuestMenu from '../../../renderer/components/brainShell/OrbQuestMenu';

test('OrbQuestMenu module loads without error', () => {
  expect(OrbQuestMenu).toBeDefined();
});

test('"Start AI Session" item is visible when menu is open', () => {
  const div = document.createElement('div');
  document.body.appendChild(div);
  render(
    <OrbQuestMenu
      anchorEl={div}
      onClose={jest.fn()}
      onStartSession={jest.fn()}
    />,
  );
  expect(screen.getByText('Start AI Session')).toBeInTheDocument();
  document.body.removeChild(div);
});

test('clicking "Start AI Session" calls onStartSession and onClose', () => {
  const onStartSession = jest.fn();
  const onClose = jest.fn();
  const div = document.createElement('div');
  document.body.appendChild(div);
  render(
    <OrbQuestMenu
      anchorEl={div}
      onClose={onClose}
      onStartSession={onStartSession}
    />,
  );
  fireEvent.click(screen.getByText('Start AI Session'));
  expect(onStartSession).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
  document.body.removeChild(div);
});
