import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import BrainOrb from '../../renderer/components/brainShell/BrainOrb';

describe('BrainOrb', () => {
  test.each([
    ['idle', 'orb-idle'],
    ['thinking', 'orb-thinking'],
    ['has-proposal', 'orb-has-proposal'],
    ['mid-flow', 'orb-mid-flow'],
    ['uncertain', 'orb-uncertain'],
  ])('renders %s state with class %s', (state, cls) => {
    const { container } = render(<BrainOrb state={state} queueDepth={0} />);
    expect(container.querySelector(`.${cls}`)).toBeTruthy();
  });

  test('shows queue depth badge when > 1', () => {
    render(<BrainOrb state="has-proposal" queueDepth={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('hides badge when queueDepth <= 1', () => {
    render(<BrainOrb state="has-proposal" queueDepth={1} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('calls onClick when clicked (pull)', () => {
    const onClick = jest.fn();
    render(<BrainOrb state="idle" queueDepth={0} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /brain/i }));
    expect(onClick).toHaveBeenCalled();
  });
});
