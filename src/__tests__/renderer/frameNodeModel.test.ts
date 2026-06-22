// src/__tests__/renderer/frameNodeModel.test.ts
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';

describe('FrameNodeModel', () => {
  test('defaults width/height/label/color', () => {
    const frame = new FrameNodeModel({});
    expect(frame.width).toBe(400);
    expect(frame.height).toBe(300);
    expect(frame.label).toBe('');
    expect(frame.accentColor).toBe('#9e9e9e');
    expect(frame.containedNodeIds).toEqual([]);
  });

  test('addContained / removeContained mutate the set without duplicates', () => {
    const frame = new FrameNodeModel({});
    frame.addContained('node-1');
    frame.addContained('node-2');
    frame.addContained('node-1'); // duplicate
    expect(frame.containedNodeIds).toEqual(['node-1', 'node-2']);
    frame.removeContained('node-1');
    expect(frame.containedNodeIds).toEqual(['node-2']);
  });

  test('serialize/deserialize round-trip preserves all fields', () => {
    const frame = new FrameNodeModel({
      width: 500,
      height: 200,
      label: 'Vocabulary cluster',
      accentColor: '#42a5f5',
    });
    frame.addContained('a');
    frame.addContained('b');
    const data = frame.serialize();
    const restored = new FrameNodeModel({});
    restored.deserialize({ data });
    expect(restored.width).toBe(500);
    expect(restored.height).toBe(200);
    expect(restored.label).toBe('Vocabulary cluster');
    expect(restored.accentColor).toBe('#42a5f5');
    expect(restored.containedNodeIds).toEqual(['a', 'b']);
  });

  test('type is "frame"', () => {
    const frame = new FrameNodeModel({});
    expect(frame.getType()).toBe('frame');
  });
});
