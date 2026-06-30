import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ModelBuildPanel from '../../renderer/views/translate/ModelBuildPanel';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const sampleSteps = {
  'step-1': {
    title: 'SVO-Title',
    'sub-verb-obj-list': [
      {
        subject: { input: 'a', english: 'A' },
        verb: { input: 'b', english: ['B'] },
        object: { input: 'c', english: 'C' },
      },
    ],
    explain: 'e1',
  },
  'step-2': {
    title: 'Verbs-Title',
    'input-verb-list': [{ 'input-verb': 'b', 'english-verb-options': ['B'] }],
    explain: 'e2',
  },
  'step-3': {
    title: 'Scaffold-Title',
    'scaffold-options': ['x', 'y'],
    'best-scaffold': 'x',
    explain: 'e3',
  },
  'step-4': { title: 'Structure-Title', 'sentence-structure': 'simple', explain: 'e4' },
  'step-5': { title: 'Final-Title', output: 'A B C', explain: 'e5' },
};

describe('ModelBuildPanel', () => {
  test('renders all 5 step cards at once (no setInterval gating)', () => {
    const { getByText } = wrap(
      <ModelBuildPanel steps={sampleSteps} originalTokens={[]} language="Chinese" />,
    );
    expect(getByText('SVO-Title')).toBeTruthy();
    expect(getByText('Verbs-Title')).toBeTruthy();
    expect(getByText('Scaffold-Title')).toBeTruthy();
    expect(getByText('Structure-Title')).toBeTruthy();
    expect(getByText('Final-Title')).toBeTruthy();
  });

  test('calls onDemote(stepNumber) when "try this step yourself" link clicked', () => {
    const onDemote = jest.fn();
    const { getAllByText } = wrap(
      <ModelBuildPanel
        steps={sampleSteps}
        originalTokens={[]}
        language="Chinese"
        onDemote={onDemote}
      />,
    );
    const links = getAllByText(/try this step yourself/i);
    expect(links.length).toBe(5);
    fireEvent.click(links[0]);
    expect(onDemote).toHaveBeenCalledWith(1);
    fireEvent.click(links[2]);
    expect(onDemote).toHaveBeenCalledWith(3);
  });

  test('does not render demote link when onDemote is omitted', () => {
    const { queryAllByText } = wrap(
      <ModelBuildPanel steps={sampleSteps} originalTokens={[]} language="Chinese" />,
    );
    expect(queryAllByText(/try this step yourself/i)).toHaveLength(0);
  });

  test('returns null when steps is falsy', () => {
    const { container } = wrap(<ModelBuildPanel steps={null} />);
    expect(container.firstChild).toBeNull();
  });
});
