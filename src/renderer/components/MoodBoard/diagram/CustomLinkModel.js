import { DefaultLinkModel } from '@projectstorm/react-diagrams';

class CustomLinkModel extends DefaultLinkModel {
  constructor(options = {}) {
    super({
      ...options,
      type: 'custom-link',
    });
    this.color = options.color || 'red';
  }

  serialize() {
    return {
      ...super.serialize(),
      color: this.color,
    };
  }

  deserialize(event) {
    super.deserialize(event);
    this.color = event.data.color;
  }
}

export default CustomLinkModel;
