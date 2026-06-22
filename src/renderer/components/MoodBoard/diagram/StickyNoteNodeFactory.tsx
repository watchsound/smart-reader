// src/renderer/components/MoodBoard/diagram/StickyNoteNodeFactory.tsx
import * as React from 'react';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { StickyNoteNodeModel } from './StickyNoteNodeModel';
import StickyNoteNodeWidget from './StickyNoteNodeWidget';

export class StickyNoteNodeFactory extends AbstractReactFactory<
  StickyNoteNodeModel,
  DiagramEngine
> {
  constructor() {
    super('sticky');
  }

  generateModel() {
    return new StickyNoteNodeModel({});
  }

  generateReactWidget(event: { model: StickyNoteNodeModel }) {
    return (
      <StickyNoteNodeWidget node={event.model} engine={this.engine} />
    );
  }
}
