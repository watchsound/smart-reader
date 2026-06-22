// src/renderer/components/MoodBoard/diagram/FrameNodeFactory.tsx
import * as React from 'react';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { FrameNodeModel } from './FrameNodeModel';
import FrameNodeWidget from './FrameNodeWidget';

export class FrameNodeFactory extends AbstractReactFactory<
  FrameNodeModel,
  DiagramEngine
> {
  constructor() {
    super('frame');
  }

  generateModel() {
    return new FrameNodeModel({});
  }

  generateReactWidget(event: { model: FrameNodeModel }) {
    return <FrameNodeWidget node={event.model} engine={this.engine} />;
  }
}
