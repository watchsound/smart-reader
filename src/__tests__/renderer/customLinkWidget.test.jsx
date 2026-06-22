// src/__tests__/renderer/customLinkWidget.test.jsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import CustomLinkWidget from '../../renderer/components/MoodBoard/diagram/CustomLinkWidget';
import CustomLinkModel from '../../renderer/components/MoodBoard/diagram/CustomLinkModel';
import { RELATION_TYPES } from '../../renderer/components/MoodBoard/diagram/types';

function setup(initial = 'supports') {
  const link = new CustomLinkModel({ relationType: initial });
  link.getSVGPath = () => 'M 0 0 L 100 100';
  link.getID = () => 'test-link';
  // Minimal engine stub — widget uses engine.repaintCanvas optionally.
  const engine = { repaintCanvas: jest.fn() };
  return { link, engine };
}

describe('CustomLinkWidget right-click cycles relationType', () => {
  test('cycles supports → contrasts on right-click', () => {
    const { link, engine } = setup('supports');
    const { container } = render(
      <svg>
        <CustomLinkWidget link={link} engine={engine} path="M 0 0 L 100 100" />
      </svg>,
    );
    const hit = container.querySelector('[data-testid="link-hit"]');
    fireEvent.contextMenu(hit);
    expect(link.relationType).toBe('contrasts');
  });

  test('wraps from caused-by back to supports', () => {
    const last = RELATION_TYPES[RELATION_TYPES.length - 1];
    const first = RELATION_TYPES[0];
    const { link, engine } = setup(last);
    const { container } = render(
      <svg>
        <CustomLinkWidget link={link} engine={engine} path="M 0 0 L 100 100" />
      </svg>,
    );
    fireEvent.contextMenu(container.querySelector('[data-testid="link-hit"]'));
    expect(link.relationType).toBe(first);
  });

  test('calls engine.repaintCanvas after the change', () => {
    const { link, engine } = setup('supports');
    const { container } = render(
      <svg>
        <CustomLinkWidget link={link} engine={engine} path="M 0 0 L 100 100" />
      </svg>,
    );
    fireEvent.contextMenu(container.querySelector('[data-testid="link-hit"]'));
    expect(engine.repaintCanvas).toHaveBeenCalled();
  });
});
