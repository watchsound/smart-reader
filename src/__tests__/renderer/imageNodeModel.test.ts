import { ImageNodeModel } from '../../renderer/components/MoodBoard/diagram/ImageNodeModel';

describe('ImageNodeModel', () => {
  test('defaults: empty src, 240x180, rotation 0', () => {
    const i = new ImageNodeModel({});
    expect(i.src).toBe('');
    expect(i.width).toBe(240);
    expect(i.height).toBe(180);
    expect(i.rotation).toBe(0);
    expect(i.getType()).toBe('image');
  });

  test('serialize/deserialize round-trip preserves src + rotation', () => {
    const i = new ImageNodeModel({
      src: 'data:image/png;base64,XXX',
      width: 400,
      height: 300,
      rotation: 15,
    });
    const data = i.serialize();
    const r = new ImageNodeModel({});
    r.deserialize({ data });
    expect(r.src).toBe('data:image/png;base64,XXX');
    expect(r.width).toBe(400);
    expect(r.height).toBe(300);
    expect(r.rotation).toBe(15);
  });

  test('setSrc updates the field', () => {
    const i = new ImageNodeModel({});
    i.setSrc('data:image/jpeg;base64,YYY');
    expect(i.src).toBe('data:image/jpeg;base64,YYY');
  });
});
