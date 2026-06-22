// src/renderer/components/MoodBoard/diagram/FrameNodeModel.ts
import {
  NodeModel,
  NodeModelGenerics,
  DeserializeEvent,
} from '@projectstorm/react-diagrams';

export interface FrameNodeOptions {
  width?: number;
  height?: number;
  label?: string;
  accentColor?: string;
}

export class FrameNodeModel extends NodeModel<NodeModelGenerics> {
  public label: string;
  public accentColor: string;
  public containedNodeIds: string[];

  constructor({
    width = 400,
    height = 300,
    label = '',
    accentColor = '#9e9e9e',
  }: FrameNodeOptions) {
    super({ type: 'frame' });
    this.width = width;
    this.height = height;
    this.label = label;
    this.accentColor = accentColor;
    this.containedNodeIds = [];
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  addContained(nodeId: string) {
    if (!this.containedNodeIds.includes(nodeId)) {
      this.containedNodeIds.push(nodeId);
    }
  }

  removeContained(nodeId: string) {
    this.containedNodeIds = this.containedNodeIds.filter((id) => id !== nodeId);
  }

  serialize() {
    return {
      ...super.serialize(),
      width: this.width,
      height: this.height,
      label: this.label,
      accentColor: this.accentColor,
      containedNodeIds: [...this.containedNodeIds],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deserialize(event: DeserializeEvent<this> | { data: any }) {
    super.deserialize(event as DeserializeEvent<this>);
    const d = event.data as {
      width?: number;
      height?: number;
      label?: string;
      accentColor?: string;
      containedNodeIds?: string[];
    };
    this.width = d.width ?? 400;
    this.height = d.height ?? 300;
    this.label = d.label ?? '';
    this.accentColor = d.accentColor ?? '#9e9e9e';
    this.containedNodeIds = Array.isArray(d.containedNodeIds)
      ? [...d.containedNodeIds]
      : [];
  }

  /**
   * Translate every contained node by (dx, dy). Caller supplies a lookup
   * fn that resolves a nodeId to a node-like object exposing
   * `getX() / getY() / setPosition()` — matches the storm NodeModel surface.
   * Missing ids are silently skipped so a deleted child doesn't break drag.
   */
  translateContainedBy(
    dx: number,
    dy: number,
    lookup: (id: string) => null | {
      getX(): number;
      getY(): number;
      setPosition(x: number, y: number): void;
    },
  ) {
    for (const id of this.containedNodeIds) {
      const child = lookup(id);
      if (!child) continue;
      child.setPosition(child.getX() + dx, child.getY() + dy);
    }
  }
}
