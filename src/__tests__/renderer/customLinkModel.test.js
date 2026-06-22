// src/__tests__/renderer/customLinkModel.test.js
import CustomLinkModel from '../../renderer/components/MoodBoard/diagram/CustomLinkModel';

describe('CustomLinkModel.relationType', () => {
  test('defaults to "supports" when not provided', () => {
    const link = new CustomLinkModel();
    expect(link.relationType).toBe('supports');
  });

  test('accepts a relationType constructor option', () => {
    const link = new CustomLinkModel({ relationType: 'contrasts' });
    expect(link.relationType).toBe('contrasts');
  });

  test('serialize includes relationType', () => {
    const link = new CustomLinkModel({ relationType: 'leads-to' });
    const data = link.serialize();
    expect(data.relationType).toBe('leads-to');
  });

  test('deserialize restores relationType', () => {
    const link = new CustomLinkModel();
    link.deserialize({ data: { color: 'red', relationType: 'similar' } });
    expect(link.relationType).toBe('similar');
  });

  test('deserialize falls back to "supports" on missing field (legacy boards)', () => {
    const link = new CustomLinkModel();
    link.deserialize({ data: { color: 'red' } }); // no relationType (old data)
    expect(link.relationType).toBe('supports');
  });

  test('setRelationType updates the field', () => {
    const link = new CustomLinkModel();
    link.setRelationType('caused-by');
    expect(link.relationType).toBe('caused-by');
  });
});
