import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import * as React from 'react';
import CustomLinkModel from './CustomLinkModel';
import CustomLinkWidget from './CustomLinkWidget';
import CustomLinkSegment from './CustomLinkSegment';

class CustomLinkFactory extends AbstractReactFactory {
  constructor({ color }) {
    super('custom-link');
    this.color = color || 'black';
  }

  setColor(color) {
    this.color = color;
  }

  generateModel(event) {
    return new CustomLinkModel({ color: this.color });
  }

  generateReactWidget(event) {
    return (
      <CustomLinkWidget
        factory={this}
        link={event.model}
      />
    );
  }

  generateLinkSegment(model, selected, path) {
    return (
      <g>
        <CustomLinkSegment model={model} path={path} />
      </g>
    );
  }
}

export default CustomLinkFactory;
