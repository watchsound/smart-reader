// src/renderer/components/MoodBoard/diagram/StickyNoteNodeModel.ts
import {
  NodeModel,
  NodeModelGenerics,
  DeserializeEvent,
} from '@projectstorm/react-diagrams';

export interface StickyNoteOptions {
  text?: string;
  color?: string;
  width?: number;
  height?: number;
}

export class StickyNoteNodeModel extends NodeModel<NodeModelGenerics> {
  public text: string;
  public color: string;

  constructor({
    text = '',
    color = '#fff59d',
    width = 160,
    height = 120,
  }: StickyNoteOptions) {
    super({ type: 'sticky' });
    this.text = text;
    this.color = color;
    this.width = width;
    this.height = height;
  }

  setText(text: string) {
    this.text = text;
  }

  serialize() {
    return {
      ...super.serialize(),
      text: this.text,
      color: this.color,
      width: this.width,
      height: this.height,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deserialize(event: DeserializeEvent<this> | { data: any }) {
    super.deserialize(event as DeserializeEvent<this>);
    const d = event.data as Partial<StickyNoteOptions>;
    this.text = d.text ?? '';
    this.color = d.color ?? '#fff59d';
    this.width = d.width ?? 160;
    this.height = d.height ?? 120;
  }
}
