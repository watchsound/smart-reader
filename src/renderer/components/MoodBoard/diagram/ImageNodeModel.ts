// src/renderer/components/MoodBoard/diagram/ImageNodeModel.ts
import {
  NodeModel,
  NodeModelGenerics,
  DeserializeEvent,
} from '@projectstorm/react-diagrams';

export interface ImageNodeOptions {
  src?: string;
  width?: number;
  height?: number;
  rotation?: number;
}

export class ImageNodeModel extends NodeModel<NodeModelGenerics> {
  public src: string;
  public rotation: number;

  constructor({
    src = '',
    width = 240,
    height = 180,
    rotation = 0,
  }: ImageNodeOptions) {
    super({ type: 'image' });
    this.src = src;
    this.width = width;
    this.height = height;
    this.rotation = rotation;
  }

  setSrc(src: string) {
    this.src = src;
  }

  serialize() {
    return {
      ...super.serialize(),
      src: this.src,
      width: this.width,
      height: this.height,
      rotation: this.rotation,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deserialize(event: DeserializeEvent<this> | { data: any }) {
    super.deserialize(event as DeserializeEvent<this>);
    const d = event.data as Partial<ImageNodeOptions>;
    this.src = d.src ?? '';
    this.width = d.width ?? 240;
    this.height = d.height ?? 180;
    this.rotation = d.rotation ?? 0;
  }
}
