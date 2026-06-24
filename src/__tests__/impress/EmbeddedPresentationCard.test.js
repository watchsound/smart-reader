/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock buildImpressHTML so the component test doesn't pull in impress runtime.
jest.mock('../../renderer/components/impressjs/index', () => ({
  __esModule: true,
  buildImpressHTML: jest.fn(),
}));

// Mock ImpressModal — we just need to assert "modal opened" without rendering the iframe twice.
jest.mock('../../renderer/components/impressjs/ImpressModal', () => ({
  __esModule: true,
  default: ({ open }) => (open ? <div data-testid="impress-modal-open" /> : null),
}));

const { buildImpressHTML } = require('../../renderer/components/impressjs/index');
const EmbeddedPresentationCard =
  require('../../renderer/components/impressjs/EmbeddedPresentationCard').default;

describe('EmbeddedPresentationCard', () => {
  beforeEach(() => {
    buildImpressHTML.mockReset();
  });

  test('renders skeleton then iframe after buildImpressHTML resolves', async () => {
    buildImpressHTML.mockResolvedValue('<html><body>stub</body></html>');
    const slideData = {
      layout_theme: 'helix',
      data: [{ content: 'A' }, { content: 'B' }],
    };
    const { container } = render(<EmbeddedPresentationCard slideData={slideData} />);

    // Header shows slide count up front
    expect(screen.getByText('2 slides')).toBeInTheDocument();

    // Iframe appears once buildImpressHTML resolves
    await waitFor(() => {
      const iframe = container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe.getAttribute('srcdoc')).toContain('stub');
    });
  });

  test('clicking the preview opens the full-screen modal', async () => {
    buildImpressHTML.mockResolvedValue('<html><body>stub</body></html>');
    const { container } = render(
      <EmbeddedPresentationCard
        slideData={{ data: [{ content: 'A' }] }}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector('iframe')).not.toBeNull();
    });

    // The click shield is the second div under the PreviewBox (zIndex 2).
    // It's the only sibling of the iframe inside the preview wrapper.
    const iframe = container.querySelector('iframe');
    const previewBox = iframe.parentElement;
    const shield = Array.from(previewBox.children).find((c) => c.tagName === 'DIV');
    expect(shield).toBeTruthy();
    fireEvent.click(shield);

    expect(screen.getByTestId('impress-modal-open')).toBeInTheDocument();
  });

  test('renders fallback when slideData has no slides', () => {
    render(<EmbeddedPresentationCard slideData={{ data: [] }} />);
    expect(screen.getByText('Presentation unavailable.')).toBeInTheDocument();
    expect(buildImpressHTML).not.toHaveBeenCalled();
  });

  test('renders fallback when buildImpressHTML returns null', async () => {
    buildImpressHTML.mockResolvedValue(null);
    render(
      <EmbeddedPresentationCard
        slideData={{ data: [{ content: 'A' }] }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Presentation unavailable.')).toBeInTheDocument();
    });
  });
});
