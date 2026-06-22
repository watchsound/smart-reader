// src/renderer/components/MoodBoard/diagram/ImageNodeFactory.tsx
import * as React from 'react';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { ImageNodeModel } from './ImageNodeModel';
import ImageNodeWidget from './ImageNodeWidget';

export class ImageNodeFactory extends AbstractReactFactory<
  ImageNodeModel,
  DiagramEngine
> {
  constructor() {
    super('image');
  }

  generateModel() {
    return new ImageNodeModel({});
  }

  generateReactWidget(event: { model: ImageNodeModel }) {
    return <ImageNodeWidget node={event.model} engine={this.engine} />;
  }
}
