/* eslint-disable prettier/prettier */
/* eslint-disable import/prefer-default-export */
import * as React from 'react';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { NoteNodeModel } from './NoteNodeModel';
import   NoteNodeWidget   from './NoteNodeWidget';

export class NoteNodeFactory extends AbstractReactFactory<
  NoteNodeModel,
  DiagramEngine
> {
  constructor() {
    super('note');
  }

  generateReactWidget(event): JSX.Element {
    const {model} = event;
    return <NoteNodeWidget engine={this.engine}  node={model} />;
  }

  generateModel(event) {
    return new NoteNodeModel({note:undefined});
  }
}
