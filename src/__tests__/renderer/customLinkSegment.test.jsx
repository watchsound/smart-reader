// src/__tests__/renderer/customLinkSegment.test.jsx
import React from 'react';
import { render } from '@testing-library/react';
import CustomLinkSegment from '../../renderer/components/MoodBoard/diagram/CustomLinkSegment';
import CustomLinkModel from '../../renderer/components/MoodBoard/diagram/CustomLinkModel';
import { RELATION_STYLES } from '../../renderer/components/MoodBoard/diagram/types';

function makeLink(relationType) {
  const link = new CustomLinkModel({ relationType });
  // Storm models don't compute geometry without an engine; stub the path.
  link.getSVGPath = () => 'M 0 0 L 100 100';
  link.getID = () => `id-${relationType}`;
  return link;
}

describe('CustomLinkSegment relationType styling', () => {
  test('supports → solid dark-gray forward arrow', () => {
    const link = makeLink('supports');
    const { container } = render(
      <svg><CustomLinkSegment link={link} path="M 0 0 L 100 100" /></svg>,
    );
    const path = container.querySelector('path[data-testid="link-stroke"]');
    expect(path?.getAttribute('stroke')).toBe(RELATION_STYLES.supports.stroke);
    expect(path?.getAttribute('stroke-dasharray')).toBe('');
  });

  test('contrasts → red dashed bidirectional', () => {
    const link = makeLink('contrasts');
    const { container } = render(
      <svg><CustomLinkSegment link={link} path="M 0 0 L 100 100" /></svg>,
    );
    const path = container.querySelector('path[data-testid="link-stroke"]');
    expect(path?.getAttribute('stroke')).toBe(RELATION_STYLES.contrasts.stroke);
    expect(path?.getAttribute('stroke-dasharray')).toBe('6 4');
  });

  test('similar → light gray no arrowhead', () => {
    const link = makeLink('similar');
    const { container } = render(
      <svg><CustomLinkSegment link={link} path="M 0 0 L 100 100" /></svg>,
    );
    const arrowFwd = container.querySelector('[data-testid="arrow-forward"]');
    const arrowBwd = container.querySelector('[data-testid="arrow-backward"]');
    expect(arrowFwd).toBeNull();
    expect(arrowBwd).toBeNull();
  });

  test('caused-by → backward arrowhead', () => {
    const link = makeLink('caused-by');
    const { container } = render(
      <svg><CustomLinkSegment link={link} path="M 0 0 L 100 100" /></svg>,
    );
    expect(
      container.querySelector('[data-testid="arrow-backward"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="arrow-forward"]'),
    ).toBeNull();
  });
});
